const request = require('supertest');
const { createApp } = require('../src/app');
const Team = require('../src/models/Team');
const Attempt = require('../src/models/Attempt');
const Challenge = require('../src/models/Challenge');
const { seedThemes } = require('./helpers/themes');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const join = (auth, code) => request(app).post('/api/teams/join').set('Authorization', auth).send({ code });

let alice;
let bob;
let team;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
  bob = await createPlayer(app, 'bob');
  team = (await request(app).post('/api/teams').set('Authorization', alice.auth).send({ name: 'Night Owls' })).body;
});

test('a second player joins with the code; codes are case-insensitive', async () => {
  const res = await join(bob.auth, team.inviteCode.toLowerCase());
  expect(res.status).toBe(200);
  expect(res.body.members.map((m) => m.username)).toEqual(['alice', 'bob']);
  expect(res.body.isCaptain).toBe(false);
  expect(res.body.inviteCode).toBe(team.inviteCode);
});

test('unknown code → 404 INVALID_INVITE_CODE', async () => {
  const res = await join(bob.auth, 'ZZZZ2222');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('INVALID_INVITE_CODE');
});

test('a third player is refused with 409 TEAM_FULL', async () => {
  const carol = await createPlayer(app, 'carol');
  await join(bob.auth, team.inviteCode);
  const res = await join(carol.auth, team.inviteCode);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('TEAM_FULL');
});

test('a member joining again → 409 ALREADY_MEMBER', async () => {
  const res = await join(alice.auth, team.inviteCode);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('ALREADY_MEMBER');
});

test('concurrent joins for the last slot: exactly one wins', async () => {
  const carol = await createPlayer(app, 'carol');
  const [r1, r2] = await Promise.all([join(bob.auth, team.inviteCode), join(carol.auth, team.inviteCode)]);
  expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  const [winner, loser] = r1.status === 200 ? [bob, carol] : [carol, bob];
  expect((r1.status === 200 ? r2 : r1).body.error).toBe('TEAM_FULL');
  const ids = (await Team.findById(team.id)).memberIds.map(String);
  expect(ids).toHaveLength(2);
  expect(ids).toEqual(expect.arrayContaining([alice.user.id, winner.user.id]));
  expect(ids).not.toContain(loser.user.id);
});

test('captain renames; the partner gets 403 NOT_CAPTAIN; a duplicate name → 409', async () => {
  await join(bob.auth, team.inviteCode);
  const rename = (auth, name) => request(app).patch(`/api/teams/${team.id}`).set('Authorization', auth).send({ name });

  const ok = await rename(alice.auth, 'Early Birds');
  expect(ok.status).toBe(200);
  expect(ok.body.name).toBe('Early Birds');

  const denied = await rename(bob.auth, 'Bob Team');
  expect(denied.status).toBe(403);
  expect(denied.body.error).toBe('NOT_CAPTAIN');

  await request(app).post('/api/teams').set('Authorization', bob.auth).send({ name: 'Taken Name' });
  const dup = await rename(alice.auth, 'taken name');
  expect(dup.status).toBe(409);
  expect(dup.body.error).toBe('TEAM_NAME_TAKEN');

  const invalid = await rename(alice.auth, 'x');
  expect(invalid.status).toBe(400);
});

test('a new invite code invalidates the old one', async () => {
  const res = await request(app).post(`/api/teams/${team.id}/invite-code`).set('Authorization', alice.auth);
  expect(res.status).toBe(200);
  expect(res.body.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(res.body.inviteCode).not.toBe(team.inviteCode);

  expect((await join(bob.auth, team.inviteCode)).body.error).toBe('INVALID_INVITE_CODE');
  expect((await join(bob.auth, res.body.inviteCode)).status).toBe(200);
});

test('only the captain can make a new invite code', async () => {
  await join(bob.auth, team.inviteCode);
  const res = await request(app).post(`/api/teams/${team.id}/invite-code`).set('Authorization', bob.auth);
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('NOT_CAPTAIN');
});

test('guests cannot join → 403 GUEST_NOT_ALLOWED', async () => {
  const guest = await createGuest(app);
  const res = await join(guest.auth, team.inviteCode);
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('GUEST_NOT_ALLOWED');
});

test('a malformed code is a validation error', async () => {
  const res = await join(bob.auth, { $ne: null });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
});

async function openChallenge(creator) {
  await seedThemes();
  const now = Date.now();
  const created = await request(app).post('/api/challenges').set('Authorization', creator.auth).send({
    name: 'Friday Heist', theme: 'cyber-heist', visibility: 'private',
    startsAt: new Date(now + 3600e3).toISOString(), endsAt: new Date(now + 3 * 3600e3).toISOString(),
  });
  await Challenge.updateOne({ code: created.body.code }, { startsAt: new Date(now - 3600e3) });
  return created.body;
}
const enter = (auth, challengeId, teamId) =>
  request(app).post(`/api/challenges/${challengeId}/entries`).set('Authorization', auth).send({ teamId });

async function soloEntry(ch) {
  // alice and bob enter, then bob leaves: the team keeps an entry with one player.
  await join(bob.auth, team.inviteCode);
  const res = await enter(alice.auth, ch.id, team.id);
  await request(app).delete(`/api/teams/${team.id}/members/${bob.user.id}`).set('Authorization', alice.auth);
  return res.body.attemptId;
}

test('CHAL-6: the new partner is added to the entered attempt', async () => {
  const ch = await openChallenge(alice);
  const attemptId = await soloEntry(ch);
  const carol = await createPlayer(app, 'carol');
  expect((await join(carol.auth, team.inviteCode)).status).toBe(200);
  const attempt = await Attempt.findById(attemptId);
  expect(attempt.players.map((p) => p.name).sort()).toEqual(['alice', 'carol']);
  expect(attempt.memberIds).toHaveLength(2);
});

test('CHAL-6: a new partner already in that challenge with another team → 409 PARTNER_IN_CHALLENGE, team unchanged', async () => {
  const ch = await openChallenge(alice);
  const attemptId = await soloEntry(ch);
  const carol = await createPlayer(app, 'carol');
  const dave = await createPlayer(app, 'dave');
  const other = (await request(app).post('/api/teams').set('Authorization', carol.auth).send({ name: 'Other' })).body;
  await join(dave.auth, other.inviteCode);
  expect((await enter(carol.auth, ch.id, other.id)).status).toBe(201);
  const before = await Attempt.countDocuments();
  const res = await join(carol.auth, team.inviteCode);
  expect([res.status, res.body.error]).toEqual([409, 'PARTNER_IN_CHALLENGE']);
  expect((await Team.findById(team.id)).memberIds.map(String)).toEqual([alice.user.id]);
  expect((await Attempt.findById(attemptId)).players).toHaveLength(1);
  expect(await Attempt.countDocuments()).toBe(before);
});

test('the 11000 rollback: a clash after the pre-check undoes the join and the entry updates', async () => {
  const { addToEntries } = require('../src/services/teamService');
  const ch = await openChallenge(alice);
  const attemptId = await soloEntry(ch);
  const carol = await createPlayer(app, 'carol');
  const dave = await createPlayer(app, 'dave');
  const other = (await request(app).post('/api/teams').set('Authorization', carol.auth).send({ name: 'Other' })).body;
  await join(dave.auth, other.inviteCode);
  await enter(carol.auth, ch.id, other.id);
  // The join already happened when the clash is found.
  await Team.updateOne({ _id: team.id }, { $push: { memberIds: carol.user.id } });
  const doc = await Team.findById(team.id);
  await expect(addToEntries(doc, carol.user.id)).rejects.toMatchObject({ status: 409, code: 'PARTNER_IN_CHALLENGE' });
  expect((await Team.findById(team.id)).memberIds.map(String)).toEqual([alice.user.id]);
  const mine = await Attempt.findById(attemptId);
  expect(mine.memberIds.map(String)).toEqual([alice.user.id]);
  expect(mine.players.map((p) => p.id)).toEqual([alice.user.id]);
});

test('an entry that cannot take the new partner → 409 TEAM_CHANGED and the join is undone', async () => {
  const ch = await openChallenge(alice);
  const attemptId = await soloEntry(ch);
  await Attempt.updateOne({ _id: attemptId }, { $push: { players: { id: 'x', kind: 'user', name: 'ghost' } } });
  const carol = await createPlayer(app, 'carol');
  const res = await join(carol.auth, team.inviteCode);
  expect([res.status, res.body.error]).toEqual([409, 'TEAM_CHANGED']);
  expect((await Team.findById(team.id)).memberIds.map(String)).toEqual([alice.user.id]);
  expect((await Attempt.findById(attemptId)).memberIds.map(String)).toEqual([alice.user.id]);
});
