const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const { seedAdmin } = require('../src/services/userSeed');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createAdmin, createPlayer } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
let admin;

beforeAll(startDb);
beforeEach(async () => {
  await clearDb();
  await seedThemes();
  admin = await createAdmin(app);
});
afterAll(stopDb);

const as = (method, url, body) => request(app)[method](url).set('Authorization', admin.auth).send(body);
const search = async (q) => (await as('get', `/api/admin/users?q=${encodeURIComponent(q)}`)).body;

function publicChallenge(auth) {
  const now = Date.now();
  return request(app).post('/api/challenges').set('Authorization', auth).send({
    name: 'Class Cup', theme: 'cyber-heist', visibility: 'public',
    startsAt: new Date(now + 3600000).toISOString(), endsAt: new Date(now + 7200000).toISOString(),
  });
}

test('search matches part of a username or email, case-insensitively, sorted by username', async () => {
  await createPlayer(app, 'alicia');
  await createPlayer(app, 'alice');
  await createPlayer(app, 'bob');
  const found = await search('ALI');
  expect(found.map((u) => u.username)).toEqual(['alice', 'alicia']);
  expect(Object.keys(found[0]).sort()).toEqual(['createdAt', 'email', 'id', 'roles', 'username']);
  expect((await search('bob@ex')).map((u) => u.username)).toEqual(['bob']);
});

test('q of 1 character → 400; regex characters are literal', async () => {
  await createPlayer(app, 'alice');
  const short = await as('get', '/api/admin/users?q=a');
  expect([short.status, short.body.details[0].field]).toEqual([400, 'q']);
  expect(await search('.*')).toEqual([]);
});

test('at most 20 users come back', async () => {
  for (let i = 0; i < 22; i += 1) await createPlayer(app, `user${String(i).padStart(2, '0')}`);
  expect(await search('user')).toHaveLength(20);
});

test('granting organizer lets the user create a public challenge at once; removing it refuses the next one', async () => {
  const org = await createPlayer(app, 'org1');
  expect((await publicChallenge(org.auth)).body.error).toBe('PUBLIC_NEEDS_ORGANIZER');
  const on = await as('patch', `/api/admin/users/${org.user.id}/roles`, { organizer: true });
  expect(on.status).toBe(200);
  expect(on.body.roles).toEqual(expect.arrayContaining(['player', 'organizer']));
  expect((await publicChallenge(org.auth)).status).toBe(201);
  const off = await as('patch', `/api/admin/users/${org.user.id}/roles`, { organizer: false });
  expect(off.body.roles).not.toContain('organizer');
  const res = await publicChallenge(org.auth);
  expect([res.status, res.body.error]).toEqual([403, 'PUBLIC_NEEDS_ORGANIZER']);
});

test('granting twice keeps one organizer role; the admin role is never touched', async () => {
  await as('patch', `/api/admin/users/${admin.user.id}/roles`, { organizer: true });
  const twice = await as('patch', `/api/admin/users/${admin.user.id}/roles`, { organizer: true });
  expect(twice.body.roles.filter((r) => r === 'organizer')).toHaveLength(1);
  const off = await as('patch', `/api/admin/users/${admin.user.id}/roles`, { organizer: false });
  expect(off.body.roles).toEqual(expect.arrayContaining(['player', 'admin']));
  expect((await as('get', '/api/admin/themes')).status).toBe(200);
});

test('organizer must be a boolean; unknown or malformed id → 404 USER_NOT_FOUND', async () => {
  const p = await createPlayer(app, 'alice');
  for (const organizer of ['true', 1, null]) {
    const res = await as('patch', `/api/admin/users/${p.user.id}/roles`, { organizer });
    expect([res.status, res.body.details[0].field]).toEqual([400, 'organizer']);
  }
  for (const id of ['000000000000000000000000', 'nope']) {
    const res = await as('patch', `/api/admin/users/${id}/roles`, { organizer: true });
    expect([res.status, res.body.error]).toEqual([404, 'USER_NOT_FOUND']);
  }
});

test('seedAdmin creates, then promotes, and skips without all three values', async () => {
  const env = { email: 'Boss@Example.com', username: 'boss', password: 'boss12345' };
  expect(await seedAdmin(env)).toBe('created');
  const boss = await User.findOne({ email: 'boss@example.com' }).select('+passwordHash');
  expect(boss.roles).toEqual(expect.arrayContaining(['player', 'admin']));
  expect(await bcrypt.compare('boss12345', boss.passwordHash)).toBe(true);
  expect(await seedAdmin(env)).toBe('promoted');
  expect(await User.countDocuments({ email: 'boss@example.com' })).toBe(1);
  const p = await createPlayer(app, 'carol');
  expect(await seedAdmin({ email: 'carol@example.com', username: 'x', password: 'y' })).toBe('promoted');
  expect((await User.findById(p.user.id)).roles).toContain('admin');
  expect(await seedAdmin({ email: 'a@b.co', username: 'nopass' })).toBe('skipped');
});
