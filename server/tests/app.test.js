const request = require('supertest');
const { createApp } = require('../src/app');
const errorHandler = require('../src/middleware/errorHandler');

test('GET /api/health returns ok', async () => {
  const res = await request(createApp()).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('unknown /api route returns JSON 404', async () => {
  const res = await request(createApp()).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: 'NOT_FOUND', message: expect.any(String) });
});

test('malformed JSON body returns 400 JSON', async () => {
  const res = await request(createApp())
    .post('/api/health')
    .set('Content-Type', 'application/json')
    .send('{bad');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('BAD_JSON');
});

test('unexpected errors return 500 without stack', () => {
  const res = { statusCode: 0, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  errorHandler(new Error('boom'), {}, res, () => {});
  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
});
