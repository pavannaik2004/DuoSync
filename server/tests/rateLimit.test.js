/** NFR-6 read with Q7 (D93): per IP + account, with a per-IP ceiling, so a class behind one NAT can sign up. */
const request = require('supertest');
const { createApp } = require('../src/app');
const { startDb, clearDb, stopDb } = require('./helpers/db');

beforeAll(startDb);
beforeEach(clearDb);
afterAll(stopDb);

const login = (app, email) => request(app).post('/api/auth/login').send({ email, password: 'wrong1234' });
const statuses = async (calls) => {
  const out = [];
  for (const call of calls) out.push((await call()).status);
  return out;
};

test('the 4th login for one email in a minute → 429; another email from the same IP still gets through', async () => {
  const app = createApp({ authRateLimit: 3, authIpRateLimit: 30 });
  const got = await statuses(Array.from({ length: 4 }, () => () => login(app, 'alice@example.com')));
  expect(got).toEqual([401, 401, 401, 429]);
  const limited = await login(app, 'ALICE@example.com ');
  expect([limited.status, limited.body.error]).toEqual([429, 'RATE_LIMITED']);
  expect((await login(app, 'bob@example.com')).status).toBe(401);
});

test('the per-IP ceiling stops many accounts from one IP', async () => {
  const app = createApp({ authRateLimit: 3, authIpRateLimit: 30 });
  const got = await statuses(Array.from({ length: 31 }, (_, i) => () => login(app, `user${i}@example.com`)));
  expect(got.slice(0, 30).every((s) => s === 401)).toBe(true);
  expect(got[30]).toBe(429);
});

test('the per-IP ceiling is never below 10 × the per-key limit', async () => {
  const app = createApp({ authRateLimit: 3, authIpRateLimit: 5 });
  const got = await statuses(Array.from({ length: 12 }, (_, i) => () => login(app, `user${i}@example.com`)));
  expect(got.every((s) => s === 401)).toBe(true);
});

test('signups are keyed by email too', async () => {
  const app = createApp({ authRateLimit: 2, authIpRateLimit: 30 });
  const signup = (username, email) => () => request(app).post('/api/auth/signup').send({ username, email, password: 'secret123' });
  const got = await statuses([signup('ann', 'ann@x.co'), signup('ann2', 'ann@x.co'), signup('ann3', 'ann@x.co'), signup('ben', 'ben@x.co')]);
  expect(got).toEqual([201, 409, 429, 201]);
});

test('guest entry is keyed by nickname the same way', async () => {
  const app = createApp({ authRateLimit: 2, authIpRateLimit: 30 });
  const guest = (nickname) => () => request(app).post('/api/auth/guest').send({ nickname });
  expect(await statuses([guest('Visitor_1'), guest('visitor_1'), guest('Visitor_1'), guest('Visitor_2')])).toEqual([201, 201, 429, 201]);
});

test('a non-string email does not crash the key generator', async () => {
  const app = createApp({ authRateLimit: 3, authIpRateLimit: 30 });
  const res = await request(app).post('/api/auth/login').send({ email: { $ne: 1 }, password: 'x' });
  expect([res.status, res.body.error]).toEqual([400, 'VALIDATION_ERROR']);
});
