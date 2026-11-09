const request = require('supertest');
const { createApp } = require('../src/app');
const Team = require('../src/models/Team');
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
  expect((await Team.findById(team.id)).memberIds).toHaveLength(2);
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
