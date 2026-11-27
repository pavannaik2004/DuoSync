/** Phase 6 hardening (D108): inputs that used to slip past validation into a 500. */
const request = require('supertest');
const Theme = require('../src/models/Theme');
const LevelTemplate = require('../src/models/LevelTemplate');
const { getContent } = require('../src/content');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createAdmin, createPlayer } = require('./helpers/users');
const { startSocketServer, connect } = require('./helpers/sockets');

let srv;
let admin;

beforeAll(startDb);
beforeEach(async () => {
  await clearDb();
  await seedThemes();
  srv = await startSocketServer();
  admin = await createAdmin(srv.app);
});
afterEach(() => srv.close());
afterAll(stopDb);

const as = (method, url, body) => request(srv.app)[method](url).set('Authorization', admin.auth).send(body);

test.each([['styleKey', ['cyber']], ['timerMinutes', [15]]])('theme %s as an array → 400 naming the field', async (field, value) => {
  const res = await as('post', '/api/admin/themes', {
    slug: 'array-vault', name: 'Array Vault', timerMinutes: 15, styleKey: 'cyber',
    roles: { A: { name: 'Picker' }, B: { name: 'Reader' } }, [field]: value,
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
  expect(res.body.details.map((d) => d.field)).toContain(field);
});

test.each([['mechanic', ['caesar']], ['rewardRule', ['answer']], ['timeEstimateSec', [120]]])(
  'level %s as an array → 400 naming the field',
  async (field, value) => {
    const theme = await Theme.findOne({ slug: 'cyber-heist' });
    const level = await LevelTemplate.findOne({ themeId: theme._id, order: 1 });
    const t = getContent('cyber-heist').templates[0];
    const res = await as('put', `/api/admin/levels/${level._id}`, {
      title: t.title, mechanic: t.mechanic, params: t.params, fallback: t.fallback, [field]: value,
    });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain(field);
  },
);

test('a repeated page parameter → 400 on the challenges list and on history', async () => {
  const alice = await createPlayer(srv.app, 'alice');
  const list = await request(srv.app).get('/api/challenges?page=1&page=2').set('Authorization', alice.auth);
  expect(list.status).toBe(400);
  expect(list.body.details[0].field).toBe('page');
  const history = await request(srv.app).get('/api/users/me/history?page=1&page=2').set('Authorization', alice.auth);
  expect(history.status).toBe(400);
});

test('attempt:join with a 65-character attempt id → ATTEMPT_NOT_FOUND', async () => {
  const alice = await createPlayer(srv.app, 'alice');
  const socket = await connect(srv.url, alice.token);
  expect(await socket.emitWithAck('attempt:join', { attemptId: 'a'.repeat(65) })).toMatchObject({ error: 'ATTEMPT_NOT_FOUND' });
  expect(await socket.emitWithAck('attempt:join', { attemptId: 5 })).toMatchObject({ error: 'VALIDATION_ERROR' });
});
