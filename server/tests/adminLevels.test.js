const request = require('supertest');
const { createApp } = require('../src/app');
const Theme = require('../src/models/Theme');
const LevelTemplate = require('../src/models/LevelTemplate');
const Challenge = require('../src/models/Challenge');
const { getContent, listThemes } = require('../src/content');
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
const THEME_EDITABLE = ['name', 'genre', 'story', 'roles', 'timerMinutes', 'styleKey', 'boardLabel', 'revealText', 'failText', 'pools'];
const themeFields = (t) => Object.fromEntries(THEME_EDITABLE.map((k) => [k, t[k]]));
const LEVEL_EDITABLE = ['title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];
const levelFields = (l) => Object.fromEntries(LEVEL_EDITABLE.map((k) => [k, l[k]]));
const detail = async (id) => (await as('get', `/api/admin/themes/${id}`)).body;

/** test-vault: an inactive theme with cyber-heist's pools and the first `n` cyber-heist levels. */
async function vault(n = 5) {
  const { pools, templates } = getContent('cyber-heist');
  const created = (await as('post', '/api/admin/themes', {
    slug: 'test-vault', name: 'Test Vault', timerMinutes: 15, styleKey: 'cyber',
    roles: { A: { name: 'Picker' }, B: { name: 'Reader' } }, pools,
  })).body;
  let last = created;
  for (const t of templates.slice(0, n)) {
    const res = await as('post', `/api/admin/themes/${created.theme.id}/levels`, levelFields(t));
    expect(res.status).toBe(201);
    last = res.body;
  }
  return last;
}

async function deactivate(slug) {
  const id = await idOf(slug);
  const d = await detail(id);
  expect((await as('put', `/api/admin/themes/${id}`, { ...themeFields(d.theme), active: false })).status).toBe(200);
  return id;
}

test('five levels posted from the cyber-heist templates make a theme that activates', async () => {
  const d = await vault();
  expect(d.levels.map((l) => [l.order, l.title])).toEqual(getContent('cyber-heist').templates.map((t) => [t.order, t.title]));
  expect(d.problems).toEqual([]);
  const on = await as('put', `/api/admin/themes/${d.theme.id}`, { ...themeFields(d.theme), active: true });
  expect([on.status, on.body.theme.active]).toEqual([200, true]);
  const list = await as('get', `/api/admin/themes/${d.theme.id}/levels`);
  expect(list.body.map((l) => l.order)).toEqual([1, 2, 3, 4, 5]);
});

test('a sixth level → 409 THEME_FULL', async () => {
  const d = await vault();
  const res = await as('post', `/api/admin/themes/${d.theme.id}/levels`, levelFields(getContent('cyber-heist').templates[0]));
  expect([res.status, res.body.error]).toEqual([409, 'THEME_FULL']);
  expect(await LevelTemplate.countDocuments({ themeId: d.theme.id })).toBe(5);
});

test('deleting level 2 of an inactive theme renumbers 1..4', async () => {
  const d = await vault();
  const res = await as('delete', `/api/admin/levels/${d.levels[1].id}`);
  expect(res.status).toBe(200);
  expect(res.body.levels.map((l) => [l.order, l.title])).toEqual([[1, 'Access PIN'], [2, 'Server Reboot'], [3, 'Glyph Keypad'], [4, 'Vault Finale']]);
  expect(res.body.problems[0]).toEqual({ order: null, message: 'A theme needs exactly 5 levels (it has 4)' });
});

test('reorder swaps levels 1 and 2 without a duplicate-key error', async () => {
  const d = await vault();
  const ids = d.levels.map((l) => l.id);
  const res = await as('patch', `/api/admin/themes/${d.theme.id}/levels/order`, { levelIds: [ids[1], ids[0], ...ids.slice(2)] });
  expect(res.status).toBe(200);
  expect(res.body.levels.map((l) => l.title).slice(0, 2)).toEqual(['Firewall', 'Access PIN']);
  expect(res.body.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5]);
});

test('reorder on an active theme is checked like any other write', async () => {
  const d = await detail(await idOf('cyber-heist'));
  const ids = d.levels.map((l) => l.id);
  // The finale must stay last: a set with the finale first cannot generate.
  const res = await as('patch', `/api/admin/themes/${d.theme.id}/levels/order`, { levelIds: [ids[4], ...ids.slice(0, 4)] });
  expect([res.status, res.body.error]).toEqual([422, 'THEME_INVALID']);
  expect((await detail(d.theme.id)).levels.map((l) => l.id)).toEqual(ids);
});

test.each([
  ['a missing id', (ids) => ids.slice(1)],
  ['an id twice', (ids) => [ids[0], ...ids.slice(0, 4)]],
  ['an id from another theme', (ids, foreign) => [foreign, ...ids.slice(1)]],
  ['a non-id', (ids) => ['nope', ...ids.slice(1)]],
  ['not a list', () => 'x'],
])('reorder with %s → 400 and nothing moves', async (_, make) => {
  const d = await vault();
  const ids = d.levels.map((l) => l.id);
  const foreign = String((await LevelTemplate.findOne({ themeId: await idOf('pirate') }))._id);
  const res = await as('patch', `/api/admin/themes/${d.theme.id}/levels/order`, { levelIds: make(ids, foreign) });
  expect([res.status, res.body.error, res.body.details[0].field]).toEqual([400, 'VALIDATION_ERROR', 'levelIds']);
  expect((await detail(d.theme.id)).levels.map((l) => l.id)).toEqual(ids);
});

test('on an active theme: delete → 422; a hint edit → 200; params naming a missing pool → 422', async () => {
  const d = await detail(await idOf('cyber-heist'));
  const del = await as('delete', `/api/admin/levels/${d.levels[1].id}`);
  expect([del.status, del.body.error]).toEqual([422, 'THEME_INVALID']);
  expect(await LevelTemplate.countDocuments({ themeId: d.theme.id })).toBe(5);

  const hint = await as('put', `/api/admin/levels/${d.levels[0].id}`, { ...levelFields(d.levels[0]), hint: 'Read the colours in order.' });
  expect([hint.status, hint.body.levels[0].hint]).toEqual([200, 'Read the colours in order.']);

  const broken = { ...levelFields(d.levels[1]), params: { ...d.levels[1].params, pool: 'noSuchPool' } };
  const res = await as('put', `/api/admin/levels/${d.levels[1].id}`, broken);
  expect([res.status, res.body.error]).toEqual([422, 'THEME_INVALID']);
  expect((await LevelTemplate.findById(d.levels[1].id)).params.pool).toBe('caesarWords');
});

test('a deactivated built-in theme can be restructured, then activates again once whole', async () => {
  const id = await deactivate('cyber-heist');
  const d = await detail(id);
  const removed = d.levels[4];
  expect((await as('delete', `/api/admin/levels/${removed.id}`)).status).toBe(200);
  expect((await as('put', `/api/admin/themes/${id}`, { ...themeFields(d.theme), active: true })).status).toBe(422);
  expect((await as('post', `/api/admin/themes/${id}/levels`, levelFields(removed))).status).toBe(201);
  expect((await as('put', `/api/admin/themes/${id}`, { ...themeFields(d.theme), active: true })).status).toBe(200);
});

const deep = (n) => (n === 0 ? 'x' : { a: deep(n - 1) });
const goodFallback = () => getContent('cyber-heist').templates[0].fallback;
test.each([
  ['params', []],
  ['params', 'text'],
  ['params', { $where: 'x' }],
  ['params', deep(12)],
  ['fallback', { ...goodFallback(), 'a.b': 1 }],
  ['fallback', { ...goodFallback(), clueA: 'x' }],
  ['fallback', { ...goodFallback(), answer: 42 }],
  ['mechanic', 'teleport'],
  ['rewardRule', 'gold'],
  ['timeEstimateSec', 10],
  ['title', 'ab'],
])('%s = %j → 400 on that field', async (field, value) => {
  const d = await vault(1);
  const res = await as('put', `/api/admin/levels/${d.levels[0].id}`, { ...levelFields(d.levels[0]), [field]: value });
  expect(res.status).toBe(400);
  expect(res.body.details[0].field.split('.')[0]).toBe(field);
});

test('hint, reward rule and time estimate may be null', async () => {
  const d = await vault(1);
  const res = await as('put', `/api/admin/levels/${d.levels[0].id}`, { ...levelFields(d.levels[0]), hint: null, rewardRule: null, timeEstimateSec: null });
  expect(res.status).toBe(200);
  expect(res.body.levels[0]).toMatchObject({ hint: null, rewardRule: null, timeEstimateSec: null });
});

test('unknown level id → 404 LEVEL_NOT_FOUND; a deleted theme refuses level writes', async () => {
  const res = await as('put', '/api/admin/levels/000000000000000000000000', levelFields(getContent('cyber-heist').templates[0]));
  expect([res.status, res.body.error]).toEqual([404, 'LEVEL_NOT_FOUND']);
  const id = await idOf('pirate');
  const d = await detail(id);
  await as('delete', `/api/admin/themes/${id}`);
  expect((await as('delete', `/api/admin/levels/${d.levels[0].id}`)).body.error).toBe('THEME_DELETED');
  expect((await as('post', `/api/admin/themes/${id}/levels`, levelFields(d.levels[0]))).body.error).toBe('THEME_DELETED');
});

const builtInLevels = () => listThemes().flatMap((slug) => getContent(slug).templates.map((t) => [`${slug} #${t.order}`, slug, t.order]));
test.each(builtInLevels())('built-in level %s round-trips through PUT unchanged', async (_, slug, order) => {
  const d = await detail(await idOf(slug));
  const level = d.levels.find((l) => l.order === order);
  const res = await as('put', `/api/admin/levels/${level.id}`, levelFields(level));
  expect(res.status).toBe(200);
  expect(levelFields(res.body.levels.find((l) => l.order === order))).toEqual(levelFields(level));
});

test('a challenge created before a level edit keeps its saved levels (§6.1)', async () => {
  const player = await createPlayer(app, 'alice');
  const ch = await createOpenChallenge(app, player.auth, { theme: 'cyber-heist' });
  const before = (await Challenge.findById(ch.id)).toObject().levels;
  // The finale's fixed clue names the level titles, so a rename is refused while active (D85): deactivate first.
  const d = await detail(await deactivate('cyber-heist'));
  expect((await as('put', `/api/admin/levels/${d.levels[0].id}`, { ...levelFields(d.levels[0]), title: 'Edited PIN' })).status).toBe(200);
  expect((await Challenge.findById(ch.id)).toObject().levels).toEqual(before);
  expect(before[0].title).toBe('Access PIN');
});
