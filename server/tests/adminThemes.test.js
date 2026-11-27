const request = require('supertest');
const { createApp } = require('../src/app');
const Theme = require('../src/models/Theme');
const Challenge = require('../src/models/Challenge');
const { listThemes } = require('../src/content');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createAdmin, createPlayer } = require('./helpers/users');
const { createOpenChallenge } = require('./helpers/rooms');

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
const idOf = async (slug) => String((await Theme.findOne({ slug }))._id);
const EDITABLE = ['name', 'genre', 'story', 'roles', 'timerMinutes', 'styleKey', 'boardLabel', 'revealText', 'failText', 'pools'];
const fieldsOf = (theme) => Object.fromEntries(EDITABLE.map((k) => [k, theme[k]]));
const newTheme = (patch = {}) => ({
  slug: 'test-vault',
  name: 'Test Vault',
  timerMinutes: 15,
  styleKey: 'cyber',
  roles: { A: { name: 'Picker', description: '' }, B: { name: 'Reader', description: '' } },
  ...patch,
});
const detail = async (slug) => (await as('get', `/api/admin/themes/${await idOf(slug)}`)).body;

test('create: inactive, no levels, problems name the count', async () => {
  const res = await as('post', '/api/admin/themes', newTheme());
  expect(res.status).toBe(201);
  expect(res.body.theme).toMatchObject({ slug: 'test-vault', name: 'Test Vault', active: false, deletedAt: null, pools: {} });
  expect(res.body.levels).toEqual([]);
  expect(res.body.problems).toEqual([{ order: null, message: 'A theme needs exactly 5 levels (it has 0)' }]);
});

test('a slug used by a soft-deleted theme is still taken', async () => {
  expect((await as('delete', `/api/admin/themes/${await idOf('pirate')}`)).status).toBe(204);
  const res = await as('post', '/api/admin/themes', newTheme({ slug: 'pirate' }));
  expect([res.status, res.body.error]).toEqual([409, 'SLUG_TAKEN']);
});

test.each([['Bad Slug'], ['ab'], ['-x-y']])('slug %s → 400 on field slug', async (slug) => {
  const res = await as('post', '/api/admin/themes', newTheme({ slug }));
  expect([res.status, res.body.details[0].field]).toEqual([400, 'slug']);
});

test('PUT with a slug → 400 on field slug', async () => {
  const d = await detail('pirate');
  const res = await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), slug: 'pirate-2' });
  expect(res.status).toBe(400);
  expect(res.body.details[0]).toEqual({ field: 'slug', message: "The slug can't change" });
});

test.each(listThemes())('built-in theme %s round-trips through PUT unchanged', async (slug) => {
  const d = await detail(slug);
  expect(d.problems).toEqual([]);
  const res = await as('put', `/api/admin/themes/${d.theme.id}`, fieldsOf(d.theme));
  expect(res.status).toBe(200);
  expect(fieldsOf(res.body.theme)).toEqual(fieldsOf(d.theme));
  expect(res.body.theme.active).toBe(true);
  expect(res.body.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5]);
});

test('GET detail shows levels with their params and fallbacks', async () => {
  const d = await detail('cyber-heist');
  expect(d.levels[0]).toMatchObject({ order: 1, title: 'Access PIN', mechanic: 'decode-key', rewardRule: 'letter', timeEstimateSec: 120 });
  expect(d.levels[0].fallback.answer).toBe('9742');
  expect(d.levels[0].id).toEqual(expect.any(String));
});

test('an unknown or malformed id → 404 THEME_NOT_FOUND', async () => {
  for (const id of ['000000000000000000000000', 'nope']) {
    const res = await as('get', `/api/admin/themes/${id}`);
    expect([res.status, res.body.error]).toEqual([404, 'THEME_NOT_FOUND']);
  }
});

test('activating a theme with 0 levels → 422 THEME_INVALID and it stays inactive', async () => {
  const created = (await as('post', '/api/admin/themes', newTheme())).body;
  const res = await as('put', `/api/admin/themes/${created.theme.id}`, { ...fieldsOf(created.theme), active: true });
  expect([res.status, res.body.error]).toEqual([422, 'THEME_INVALID']);
  expect(res.body.details[0]).toEqual({ field: 'theme', message: 'A theme needs exactly 5 levels (it has 0)' });
  expect((await Theme.findOne({ slug: 'test-vault' })).active).toBe(false);
});

test('an edit that would break an active theme is refused and nothing is written', async () => {
  const d = await detail('pirate');
  const res = await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), pools: {}, name: 'Renamed' });
  expect([res.status, res.body.error]).toEqual([422, 'THEME_INVALID']);
  expect(res.body.details.some((x) => /^level \d$/.test(x.field))).toBe(true);
  const after = await Theme.findOne({ slug: 'pirate' });
  expect(after.pools.riddles.length).toBeGreaterThan(5);
  expect(after.name).toMatch(/Blackbeard/);
});

test('the same broken edit is saved on an inactive theme, and its problems are listed', async () => {
  const d = await detail('pirate');
  expect((await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), active: false })).status).toBe(200);
  const res = await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), pools: {} });
  expect(res.status).toBe(200);
  expect(res.body.theme.active).toBe(false);
  expect(res.body.problems.length).toBeGreaterThan(0);
});

test('deactivate, then reactivate a built-in theme', async () => {
  const d = await detail('pirate');
  const off = await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), active: false });
  expect([off.status, off.body.theme.active]).toEqual([200, false]);
  const player = await createPlayer(app, 'alice');
  const themes = (await request(app).get('/api/themes').set('Authorization', player.auth)).body;
  expect(themes.map((t) => t.slug)).not.toContain('pirate');
  const on = await as('put', `/api/admin/themes/${d.theme.id}`, { ...fieldsOf(d.theme), active: true });
  expect([on.status, on.body.theme.active]).toEqual([200, true]);
});

test('soft delete: gone from /api/themes and new challenges, old challenge intact, writes refused', async () => {
  const player = await createPlayer(app, 'alice');
  const old = await createOpenChallenge(app, player.auth, { theme: 'pirate' });
  const id = await idOf('pirate');
  expect((await as('delete', `/api/admin/themes/${id}`)).status).toBe(204);

  const themes = (await request(app).get('/api/themes').set('Authorization', player.auth)).body;
  expect(themes).toHaveLength(7);
  const now = Date.now();
  const fresh = await request(app).post('/api/challenges').set('Authorization', player.auth).send({
    name: 'Late Pirates', theme: 'pirate', visibility: 'private',
    startsAt: new Date(now + 3600000).toISOString(), endsAt: new Date(now + 7200000).toISOString(),
  });
  expect([fresh.status, fresh.body.error]).toEqual([404, 'THEME_NOT_FOUND']);

  const page = await request(app).get(`/api/challenges/${old.code}`).set('Authorization', player.auth);
  expect(page.status).toBe(200);
  expect((await Challenge.findById(old.id)).levels).toHaveLength(5);

  const d = await detail('pirate');
  expect(d.theme.deletedAt).toEqual(expect.any(String));
  const put = await as('put', `/api/admin/themes/${id}`, fieldsOf(d.theme));
  expect([put.status, put.body.error]).toEqual([409, 'THEME_DELETED']);
  expect((await as('delete', `/api/admin/themes/${id}`)).body.error).toBe('THEME_DELETED');

  const listed = (await as('get', '/api/admin/themes?status=deleted')).body;
  expect(listed.map((t) => [t.slug, t.deleted, t.active])).toEqual([['pirate', true, false]]);
  expect((await as('get', '/api/admin/themes')).body.map((t) => t.slug)).not.toContain('pirate');
});

test('list rows; q matches name or slug case-insensitively; status filters', async () => {
  const all = (await as('get', '/api/admin/themes')).body;
  expect(all).toHaveLength(8);
  expect(Object.keys(all[0]).sort()).toEqual(['active', 'deleted', 'genre', 'id', 'levelCount', 'name', 'slug', 'updatedAt']);
  expect(all.every((t) => t.levelCount === 5)).toBe(true);
  expect((await as('get', '/api/admin/themes?q=BLACKBEARD')).body.map((t) => t.slug)).toEqual(['pirate']);
  expect((await as('get', '/api/admin/themes?q=space-st')).body.map((t) => t.slug)).toEqual(['space-station']);
  expect((await as('get', '/api/admin/themes?q=.*')).body).toEqual([]);
  await as('post', '/api/admin/themes', newTheme());
  expect((await as('get', '/api/admin/themes?status=inactive')).body.map((t) => t.slug)).toEqual(['test-vault']);
  expect((await as('get', '/api/admin/themes?status=active')).body).toHaveLength(8);
  expect((await as('get', '/api/admin/themes?status=all')).body).toHaveLength(9);
  expect((await as('get', '/api/admin/themes?status=gone')).status).toBe(400);
});

const deep = (n) => (n === 0 ? 'x' : { a: deep(n - 1) });
test.each([
  ['a $-prefixed key', { $where: ['x'] }],
  ['a dotted key', { 'a.b': ['x'] }],
  ['12-deep nesting', { words: [deep(12)] }],
  ['a pool that is not a list', { words: 'x' }],
  ['a bad pool name', { '1words': ['x'] }],
  ['an array at the top', [['x']]],
])('pools with %s → 400 on field pools', async (_, pools) => {
  const created = (await as('post', '/api/admin/themes', newTheme())).body;
  const res = await as('put', `/api/admin/themes/${created.theme.id}`, { ...fieldsOf(created.theme), pools });
  expect(res.status).toBe(400);
  expect(res.body.details[0].field).toMatch(/^pools/);
});

test('field rules: timer, style key and role names', async () => {
  const cases = [
    [{ timerMinutes: 4 }, 'timerMinutes'],
    [{ styleKey: 'neon' }, 'styleKey'],
    [{ roles: { A: { name: 'X' }, B: { name: 'Reader' } } }, 'roles.A.name'],
  ];
  for (const [patch, field] of cases) {
    const res = await as('post', '/api/admin/themes', newTheme(patch));
    expect([res.status, res.body.details[0].field]).toEqual([400, field]);
  }
});

test('a 100 KB body is accepted on /api/admin', async () => {
  const d = await detail('pirate');
  const pad = (c) => Array.from({ length: 300 }, (_, i) => `${c}${String(i).padStart(3, '0')}`.padEnd(110, c));
  const pools = { ...d.theme.pools, padA: pad('A'), padB: pad('B'), padC: pad('C') };
  const body = { ...fieldsOf(d.theme), pools };
  expect(JSON.stringify(body).length).toBeGreaterThan(100000);
  const res = await as('put', `/api/admin/themes/${d.theme.id}`, body);
  expect(res.status).toBe(200);
  expect(res.body.theme.pools.padC).toHaveLength(300);
});
