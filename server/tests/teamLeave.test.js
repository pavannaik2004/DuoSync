const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Team = require('../src/models/Team');
const Attempt = require('../src/models/Attempt');
const Challenge = require('../src/models/Challenge');
const { seedThemes } = require('./helpers/themes');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const remove = (auth, teamId, userId) =>
  request(app).delete(`/api/teams/${teamId}/members/${userId}`).set('Authorization', auth);
const mine = async (auth) => (await request(app).get('/api/teams/mine').set('Authorization', auth)).body.teams;

let alice;
let bob;
let team;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
  bob = await createPlayer(app, 'bob');
  team = (await request(app).post('/api/teams').set('Authorization', alice.auth).send({ name: 'Night Owls' })).body;
  await request(app).post('/api/teams/join').set('Authorization', bob.auth).send({ code: team.inviteCode });
});

test('the captain removes the partner', async () => {
  const res = await remove(alice.auth, team.id, bob.user.id);
  expect(res.status).toBe(204);
  expect((await Team.findById(team.id)).memberIds).toHaveLength(1);
  expect(await mine(bob.auth)).toEqual([]);
});

test('the partner cannot remove the captain → 403 NOT_CAPTAIN', async () => {
  const res = await remove(bob.auth, team.id, alice.user.id);
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('NOT_CAPTAIN');
});

test('the partner leaves (self) → 204', async () => {
  const res = await remove(bob.auth, team.id, bob.user.id);
  expect(res.status).toBe(204);
  expect(await mine(bob.auth)).toEqual([]);
  expect((await mine(alice.auth))[0].members).toHaveLength(1);
});

test('the captain leaves while the partner stays: the partner becomes captain', async () => {
  const res = await remove(alice.auth, team.id, alice.user.id);
  expect(res.status).toBe(204);
  const saved = await Team.findById(team.id);
  expect(String(saved.captainId)).toBe(bob.user.id);
  expect(saved.archived).toBe(false);
  expect((await mine(bob.auth))[0].isCaptain).toBe(true);
});

test('the last member leaves: the team is archived and its invite code is dead', async () => {
  await remove(bob.auth, team.id, bob.user.id);
  const res = await remove(alice.auth, team.id, alice.user.id);
  expect(res.status).toBe(204);
  const saved = await Team.findById(team.id);
  expect(saved.archived).toBe(true);
  expect(saved.inviteCode).toBeUndefined();
  const carol = await createPlayer(app, 'carol');
  const join = await request(app).post('/api/teams/join').set('Authorization', carol.auth).send({ code: team.inviteCode });
  expect(join.status).toBe(404);
  expect(join.body.error).toBe('INVALID_INVITE_CODE');
});

test('removing a non-member or a malformed userId → 404 MEMBER_NOT_FOUND', async () => {
  const carol = await createPlayer(app, 'carol');
  for (const id of [carol.user.id, 'xyz', new mongoose.Types.ObjectId().toString()]) {
    const res = await remove(alice.auth, team.id, id);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('MEMBER_NOT_FOUND');
  }
});

test('an outsider cannot remove a member', async () => {
  const carol = await createPlayer(app, 'carol');
  const res = await remove(carol.auth, team.id, bob.user.id);
  expect(res.status).toBe(403);
});

test('an archived team keeps its name reserved', async () => {
  await remove(bob.auth, team.id, bob.user.id);
  await remove(alice.auth, team.id, alice.user.id);
  const res = await request(app).post('/api/teams').set('Authorization', bob.auth).send({ name: 'Night Owls' });
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('TEAM_NAME_TAKEN');
});

test('a former captain cannot rename an archived team (404)', async () => {
  await remove(bob.auth, team.id, bob.user.id);
  await remove(alice.auth, team.id, alice.user.id);
  const res = await request(app).patch(`/api/teams/${team.id}`).set('Authorization', alice.auth).send({ name: 'Ghost Crew' });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('TEAM_NOT_FOUND');
});

async function enterTeam() {
  await seedThemes();
  const now = Date.now();
  const created = await request(app).post('/api/challenges').set('Authorization', alice.auth).send({
    name: 'Friday Heist', theme: 'cyber-heist', visibility: 'private',
    startsAt: new Date(now + 3600e3).toISOString(), endsAt: new Date(now + 3 * 3600e3).toISOString(),
  });
  await Challenge.updateOne({ code: created.body.code }, { startsAt: new Date(now - 3600e3) });
  const res = await request(app).post(`/api/challenges/${created.body.id}/entries`)
    .set('Authorization', alice.auth).send({ teamId: team.id });
  return res.body.attemptId;
}

test('TEAM-7: leaving while the team attempt is in_progress → 409 TEAM_IN_ATTEMPT; team unchanged', async () => {
  const attemptId = await enterTeam();
  await Attempt.updateOne({ _id: attemptId }, { status: 'in_progress' });
  const res = await remove(bob.auth, team.id, bob.user.id);
  expect([res.status, res.body.error]).toEqual([409, 'TEAM_IN_ATTEMPT']);
  expect((await Team.findById(team.id)).memberIds).toHaveLength(2);
});

test('Review Focus 4: removing the partner before the start pulls them from the entered attempt', async () => {
  const attemptId = await enterTeam();
  await Attempt.updateOne({ _id: attemptId }, { status: 'lobby', 'players.$[].ready': true });
  expect((await remove(alice.auth, team.id, bob.user.id)).status).toBe(204);
  const attempt = await Attempt.findById(attemptId);
  expect(attempt.players.map((p) => p.id)).toEqual([alice.user.id]);
  expect(attempt.memberIds.map(String)).toEqual([alice.user.id]);
  expect(attempt.players[0].ready).toBe(false);
});

test("the last member leaving deletes the team's not-started entries", async () => {
  const attemptId = await enterTeam();
  await remove(bob.auth, team.id, bob.user.id);
  await remove(alice.auth, team.id, alice.user.id);
  expect(await Attempt.findById(attemptId)).toBeNull();
});
