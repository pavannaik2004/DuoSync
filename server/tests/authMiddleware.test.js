const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const { requirePlayer, requireRole } = require('../src/middleware/auth');
const errorHandler = require('../src/middleware/errorHandler');
const { startDb, clearDb, stopDb } = require('./helpers/db');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

async function signupToken(username = 'alice_1') {
  const res = await request(app).post('/api/auth/signup')
    .send({ username, email: `${username}@example.com`, password: 'secret123' });
  return { token: res.body.token, user: res.body.user };
}
async function guestToken(nickname = 'Visitor_9') {
  const res = await request(app).post('/api/auth/guest').send({ nickname });
  return res;
}

// A tiny app that mounts the middleware under test.
const probe = express();
probe.get('/player', requirePlayer, (req, res) => res.json({ username: req.user.username }));
probe.get('/admin', requirePlayer, requireRole('admin'), (req, res) => res.json({ ok: true }));
probe.use(errorHandler);

describe('POST /api/auth/guest', () => {
  test('guest token is issued for a valid nickname and expires in 24h', async () => {
    const res = await guestToken();
    expect(res.status).toBe(201);
    expect(res.body.guest).toEqual({ id: expect.stringMatching(/^guest_/), nickname: 'Visitor_9' });
    const payload = jwt.decode(res.body.token);
    expect(payload.kind).toBe('guest');
    expect(payload.exp - payload.iat).toBe(86400);
  });

  test('guest nickname must match NICKNAME', async () => {
    const res = await guestToken('x');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  test('returns the user for a player token', async () => {
    const { token } = await signupToken();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('user');
    expect(res.body.user.username).toBe('alice_1');
  });

  test('returns the guest for a guest token', async () => {
    const { body } = await guestToken();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ kind: 'guest', guest: { id: body.guest.id, nickname: 'Visitor_9' } });
  });

  test('without a token → 401 AUTH_REQUIRED', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTH_REQUIRED');
  });

  test('with a garbage or expired token → 401 AUTH_REQUIRED', async () => {
    const { user } = await signupToken();
    const expired = jwt.sign({ kind: 'user' }, process.env.JWT_SECRET, { subject: user.id, expiresIn: -1 });
    for (const token of ['garbage', expired]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('AUTH_REQUIRED');
    }
  });

  test('a token for a deleted user → 401 AUTH_REQUIRED', async () => {
    const { token, user } = await signupToken();
    await User.deleteOne({ _id: user.id });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('role middleware', () => {
  test('requirePlayer rejects guests with 403 GUEST_NOT_ALLOWED', async () => {
    const { body } = await guestToken();
    const res = await request(probe).get('/player').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('GUEST_NOT_ALLOWED');
  });

  test('requirePlayer passes a player and sets req.user', async () => {
    const { token } = await signupToken();
    const res = await request(probe).get('/player').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice_1');
  });

  test('requireRole("admin") rejects a player with 403 and allows an admin', async () => {
    const { token, user } = await signupToken();
    const denied = await request(probe).get('/admin').set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('FORBIDDEN');

    // A role granted in the DB applies without logging in again (DECISIONS D4).
    await User.updateOne({ _id: user.id }, { roles: ['player', 'admin'] });
    const allowed = await request(probe).get('/admin').set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);
  });
});
