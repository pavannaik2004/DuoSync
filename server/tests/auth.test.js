const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const { startDb, clearDb, stopDb } = require('./helpers/db');

const app = createApp({ authRateLimit: 1000 });
const valid = { username: 'alice_1', email: 'Alice@Example.com', password: 'secret123' };

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const signup = (body, a = app) => request(a).post('/api/auth/signup').send(body);
const login = (body, a = app) => request(a).post('/api/auth/login').send(body);

describe('POST /api/auth/signup', () => {
  test('creates a player and returns a token', async () => {
    const res = await signup(valid);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'alice_1', email: 'alice@example.com', roles: ['player'] });
    expect(res.body.user.id).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ sub: res.body.user.id, kind: 'user' });
  });

  test('stores the password hashed with cost 10', async () => {
    await signup(valid);
    const user = await User.findOne({ email: 'alice@example.com' }).select('+passwordHash');
    expect(user.passwordHash).toMatch(/^\$2/);
    expect(bcrypt.getRounds(user.passwordHash)).toBe(10);
  });

  test.each([
    ['username', 'ab'],
    ['username', 'has space'],
    ['username', 'a'.repeat(21)],
    ['email', 'not-an-email'],
    ['password', 'short1'],
    ['password', 'lettersonly'],
    ['password', '12345678'],
  ])('rejects invalid %s %p', async (field, value) => {
    const res = await signup({ ...valid, [field]: value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.details[0].field).toBe(field);
  });

  test('rejects a username differing only in case', async () => {
    await signup({ ...valid, username: 'Alice' });
    const res = await signup({ ...valid, username: 'alice', email: 'other@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('USERNAME_TAKEN');
  });

  test('rejects a duplicate email', async () => {
    await signup(valid);
    const res = await signup({ ...valid, username: 'bob_2', email: 'ALICE@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_TAKEN');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => signup(valid));

  test('logs in with correct credentials', async () => {
    const res = await login({ email: 'alice@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.username).toBe('alice_1');
  });

  test('wrong password and unknown email give the same 401', async () => {
    const wrong = await login({ email: 'alice@example.com', password: 'wrong1234' });
    const unknown = await login({ email: 'nobody@example.com', password: 'secret123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ error: 'INVALID_CREDENTIALS', message: expect.any(String) });
    expect(unknown.body).toEqual(wrong.body);
  });

  test('rejects operator objects', async () => {
    const res = await login({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('rate limits after 10 attempts per minute', async () => {
    const limited = createApp({ authRateLimit: 10 });
    for (let i = 0; i < 10; i += 1) {
      const ok = await login({ email: 'alice@example.com', password: 'wrong1234' }, limited);
      expect(ok.status).toBe(401);
    }
    const res = await login({ email: 'alice@example.com', password: 'wrong1234' }, limited);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('RATE_LIMITED');
  });
});
