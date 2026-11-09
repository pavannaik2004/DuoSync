const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const createTeam = (auth, name) => request(app).post('/api/teams').set('Authorization', auth).send({ name });

test('creating a team makes the creator captain with an 8-char invite code', async () => {
  const alice = await createPlayer(app, 'alice');
  const res = await createTeam(alice.auth, 'Night Owls');
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ name: 'Night Owls', captainId: alice.user.id, isCaptain: true, archived: false });
  expect(res.body.members).toEqual([{ id: alice.user.id, username: 'alice', avatarColor: alice.user.avatarColor }]);
  expect(res.body.inviteCode).toMatch(CODE);
});

test.each(['ab', 'x'.repeat(25), '  ', 'bad<name>', ' lead', 'two  spaces'])('rejects team name %p', async (name) => {
  const alice = await createPlayer(app, 'alice');
  const res = await createTeam(alice.auth, name);
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
});

test('team names are unique case-insensitively', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  await createTeam(alice.auth, 'Night Owls');
  const res = await createTeam(bob.auth, 'night owls');
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('TEAM_NAME_TAKEN');
});

test('GET /mine lists only my active teams', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  await createTeam(alice.auth, 'Alpha Team');
  await createTeam(bob.auth, 'Bravo Team');
  const res = await request(app).get('/api/teams/mine').set('Authorization', alice.auth);
  expect(res.status).toBe(200);
  expect(res.body.teams.map((t) => t.name)).toEqual(['Alpha Team']);
});

test('non-members see the team without the invite code', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const team = (await createTeam(alice.auth, 'Night Owls')).body;
  const res = await request(app).get(`/api/teams/${team.id}`).set('Authorization', bob.auth);
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Night Owls');
  expect(res.body.isCaptain).toBe(false);
  expect(res.body).not.toHaveProperty('inviteCode');
});

test('malformed or unknown team id → 404 TEAM_NOT_FOUND', async () => {
  const alice = await createPlayer(app, 'alice');
  for (const id of ['abc', new mongoose.Types.ObjectId().toString()]) {
    const res = await request(app).get(`/api/teams/${id}`).set('Authorization', alice.auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('TEAM_NOT_FOUND');
  }
});

test('guests cannot create teams', async () => {
  const guest = await createGuest(app);
  const res = await createTeam(guest.auth, 'Night Owls');
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('GUEST_NOT_ALLOWED');
});
