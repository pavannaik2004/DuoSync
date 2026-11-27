const request = require('supertest');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const { AVATAR_COLORS } = User;

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const patch = (auth, body) => request(app).patch('/api/users/me').set('Authorization', auth).send(body);

let alice;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
});

test('PATCH username → 200, and the profile and team page show the new name (AUTH-7)', async () => {
  const team = await request(app).post('/api/teams').set('Authorization', alice.auth).send({ name: 'Night Owls' });
  const res = await patch(alice.auth, { username: 'alice_v2' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ username: 'alice_v2', avatarColors: AVATAR_COLORS });
  expect((await request(app).get('/api/users/me').set('Authorization', alice.auth)).body.username).toBe('alice_v2');
  const page = await request(app).get(`/api/teams/${team.body.id}`).set('Authorization', alice.auth);
  expect(page.body.members.map((m) => m.username)).toEqual(['alice_v2']);
});

test('a name another player has in any case → 409 USERNAME_TAKEN; your own name in another case → 200', async () => {
  await createPlayer(app, 'bob');
  const taken = await patch(alice.auth, { username: 'BOB' });
  expect(taken.status).toBe(409);
  expect(taken.body.error).toBe('USERNAME_TAKEN');
  const mine = await patch(alice.auth, { username: 'ALICE' });
  expect(mine.status).toBe(200);
  expect(mine.body.username).toBe('ALICE');
});

test.each([['ab'], ['a b'], ['x'.repeat(21)], [['alice2']], [{ $ne: 1 }], [5]])('username %p → 400 naming username', async (username) => {
  const res = await patch(alice.auth, { username });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
  expect(res.body.details[0].field).toBe('username');
});

test('a colour from the list → 200; any other colour → 400', async () => {
  const ok = await patch(alice.auth, { avatarColor: AVATAR_COLORS[3] });
  expect(ok.status).toBe(200);
  expect(ok.body.avatarColor).toBe(AVATAR_COLORS[3]);
  for (const avatarColor of ['#000000', 'red', [AVATAR_COLORS[0]]]) {
    const res = await patch(alice.auth, { avatarColor });
    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('avatarColor');
  }
});

test('an empty body → 400 VALIDATION_ERROR', async () => {
  const res = await patch(alice.auth, {});
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
});

test('a guest → 403 GUEST_NOT_ALLOWED; no token → 401', async () => {
  const guest = await createGuest(app);
  expect((await patch(guest.auth, { username: 'guesty' })).status).toBe(403);
  expect((await request(app).patch('/api/users/me').send({ username: 'nobody' })).status).toBe(401);
});

test('email, roles and password in the body are ignored', async () => {
  const res = await patch(alice.auth, { username: 'alice3', email: 'x@y.z', roles: ['admin'], passwordHash: 'x' });
  expect(res.status).toBe(200);
  const user = await User.findById(alice.user.id).select('+passwordHash');
  expect(user.roles).toEqual(['player']);
  expect(user.email).toBe('alice@example.com');
  expect(user.passwordHash).not.toBe('x');
});
