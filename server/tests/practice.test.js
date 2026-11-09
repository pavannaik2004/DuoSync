const request = require('supertest');
const { createApp } = require('../src/app');
const Attempt = require('../src/models/Attempt');
const { joinPractice } = require('../src/services/practiceService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest, createRoom } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const preview = (auth, code) => request(app).get(`/api/practice/${code}`).set('Authorization', auth);
const identity = (id, name, kind = 'user') => ({ id, kind, name });

test('a player creates a room; the code is 6 characters from the alphabet', async () => {
  const alice = await createPlayer(app, 'alice');
  const res = await request(app).post('/api/practice').set('Authorization', alice.auth);
  expect(res.status).toBe(201);
  expect(res.body.code).toMatch(CODE);
  const saved = await Attempt.findOne({ practiceCode: res.body.code });
  expect(saved).toMatchObject({ status: 'lobby', themeSlug: 'cyber-heist', timerMinutes: 15, challengeId: null });
  expect(saved.players.map((p) => ({ id: p.id, kind: p.kind, name: p.name, role: p.role, ready: p.ready })))
    .toEqual([{ id: alice.user.id, kind: 'user', name: 'alice', role: null, ready: false }]);
  expect(saved.levels).toHaveLength(0);
});

test('a guest can create and preview a room (D32)', async () => {
  const guest = await createGuest(app, 'Visitor_9');
  const code = await createRoom(app, guest.auth);
  const res = await preview(guest.auth, code);
  expect(res.status).toBe(200);
  expect(res.body.players).toEqual([{ name: 'Visitor_9', role: null }]);
});

test('preview: theme, timer, roles, membership and seats', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const code = await createRoom(app, alice.auth);

  const mine = await preview(alice.auth, code);
  expect(mine.body).toMatchObject({
    code,
    status: 'lobby',
    theme: { slug: 'cyber-heist', timerMinutes: 15, roles: { A: { name: 'Hacker' }, B: { name: 'Decoder' } } },
    isMember: true,
    full: false,
  });
  expect(mine.body.theme.story).toEqual(expect.any(String));

  const theirs = await preview(bob.auth, code);
  expect(theirs.body.isMember).toBe(false);
  expect(JSON.stringify(theirs.body)).not.toContain(alice.user.id);
});

test('preview with a lower-case code works', async () => {
  const alice = await createPlayer(app, 'alice');
  const code = await createRoom(app, alice.auth);
  expect((await preview(alice.auth, code.toLowerCase())).status).toBe(200);
});

test.each(['ZZZZZZ', 'abc', 'ABCDEFG', 'IIIIII'])('unknown or malformed code %p → 404 PRACTICE_NOT_FOUND', async (code) => {
  const alice = await createPlayer(app, 'alice');
  const res = await preview(alice.auth, code);
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('PRACTICE_NOT_FOUND');
});

test('no token → 401', async () => {
  expect((await request(app).post('/api/practice')).status).toBe(401);
  expect((await request(app).get('/api/practice/ABCDEF')).status).toBe(401);
});

describe('joinPractice', () => {
  let code;
  beforeEach(async () => {
    const alice = await createPlayer(app, 'alice');
    code = await createRoom(app, alice.auth);
  });

  test('two people race for the second seat → exactly one joins', async () => {
    const results = await Promise.allSettled([
      joinPractice(code, identity('bob-id', 'bob')),
      joinPractice(code, identity('guest_cara', 'cara', 'guest')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.code).toBe('ROOM_FULL');
    expect((await Attempt.findOne({ practiceCode: code })).players).toHaveLength(2);
  });

  test('a member re-joining is a no-op', async () => {
    await joinPractice(code, identity('bob-id', 'bob'));
    const again = await joinPractice(code, identity('bob-id', 'bob'));
    expect(again.players.map((p) => p.name)).toEqual(['alice', 'bob']);
  });

  test('after the start a newcomer gets ALREADY_STARTED; an unknown code gets PRACTICE_NOT_FOUND', async () => {
    await Attempt.updateOne({ practiceCode: code }, { status: 'in_progress' });
    await expect(joinPractice(code, identity('bob-id', 'bob'))).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
    await expect(joinPractice('ZZZZZZ', identity('bob-id', 'bob'))).rejects.toMatchObject({ code: 'PRACTICE_NOT_FOUND' });
  });
});
