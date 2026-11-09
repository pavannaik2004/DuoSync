const request = require('supertest');
const { createApp } = require('../src/app');
const { parseOrigins } = require('../src/config/env');

test('parseOrigins trims spaces and trailing slashes and splits on commas', () => {
  expect(parseOrigins(' https://duosync.vercel.app/ , http://localhost:5173')).toEqual([
    'https://duosync.vercel.app',
    'http://localhost:5173',
  ]);
});

test('a CLIENT_ORIGIN written with a trailing slash still allows that origin', async () => {
  const app = createApp({ clientOrigins: parseOrigins('https://duosync.vercel.app/') });
  const res = await request(app)
    .options('/api/auth/login')
    .set('Origin', 'https://duosync.vercel.app')
    .set('Access-Control-Request-Method', 'POST');
  expect(res.headers['access-control-allow-origin']).toBe('https://duosync.vercel.app');
});

test('origins not in the list get no CORS header', async () => {
  const app = createApp({ clientOrigins: parseOrigins('https://duosync.vercel.app') });
  const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  expect(res.headers['access-control-allow-origin']).toBeUndefined();
});
