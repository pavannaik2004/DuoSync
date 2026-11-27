const request = require('supertest');
const { createApp } = require('../src/app');
const Theme = require('../src/models/Theme');
const Challenge = require('../src/models/Challenge');
const Attempt = require('../src/models/Attempt');
const { MECHANICS, STYLE_KEYS, REWARD_RULES, CLUE_TYPES } = require('../src/content/catalog');
const { poolNamesIn } = require('../src/services/adminCatalog');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createAdmin } = require('./helpers/users');

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

test('poolNamesIn finds pool names used as string values anywhere in params', () => {
  const pools = { words: [], riddles: [], unused: [] };
  expect(poolNamesIn({ pool: 'words', nested: { list: ['riddles', 'other'] }, n: 3 }, pools).sort()).toEqual(['riddles', 'words']);
});

test('the catalog lists every mechanic with examples, and the form lists', async () => {
  const res = await as('get', '/api/admin/catalog');
  expect(res.status).toBe(200);
  expect(res.body.mechanics.map((m) => m.slug)).toEqual(MECHANICS);
  expect(res.body).toMatchObject({ styleKeys: STYLE_KEYS, rewardRules: REWARD_RULES, clueTypes: CLUE_TYPES });
  expect(res.body.symbolShapes).toHaveLength(16);
  expect(res.body.tokenColors).toHaveLength(6);
  for (const m of res.body.mechanics) {
    expect([m.slug, m.examples.length > 0]).toEqual([m.slug, true]);
    for (const ex of m.examples) {
      expect(ex.mechanic).toBe(m.slug);
      expect(Object.keys(ex).sort()).toEqual(['fallback', 'hint', 'mechanic', 'order', 'params', 'pools', 'rewardRule', 'theme', 'timeEstimateSec', 'title']);
      if (typeof ex.params.pool === 'string') expect(ex.pools[ex.params.pool].length).toBeGreaterThan(0);
      expect(Object.keys(ex.pools).sort()).toEqual(poolNamesIn(ex.params, ex.pools).sort());
    }
  }
  const firewall = res.body.mechanics.find((m) => m.slug === 'caesar').examples.find((e) => e.theme === 'cyber-heist');
  expect(firewall).toMatchObject({ title: 'Firewall', order: 2 });
  expect(Object.keys(firewall.pools)).toEqual(['caesarWords']);
});

test('preview with seed "abc" twice is identical; seed "abd" differs', async () => {
  const id = await idOf('cyber-heist');
  const a = (await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abc' })).body;
  const b = (await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abc' })).body;
  const c = (await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abd' })).body;
  expect(a).toEqual(b);
  expect(a).toMatchObject({ seed: 'abc', usedFallback: false, failure: null });
  expect(a.levels.map((l) => [l.order, l.mechanic])).toEqual([[1, 'decode-key'], [2, 'caesar'], [3, 'rule-filter'], [4, 'describe-match'], [5, 'fragment-finale']]);
  expect(Object.keys(a.levels[0]).sort()).toEqual(['acceptedAnswers', 'answer', 'answerKind', 'clueA', 'clueB', 'explanation', 'hint', 'mechanic', 'order', 'reward', 'title']);
  expect(c.levels.map((l) => l.answer)).not.toEqual(a.levels.map((l) => l.answer));
});

test('preview without a seed picks a random one', async () => {
  const res = await as('post', `/api/admin/themes/${await idOf('pirate')}/preview`, {});
  expect(res.status).toBe(200);
  expect(res.body.seed).toMatch(/^[0-9a-f]{16}$/);
  expect(res.body.levels).toHaveLength(5);
});

test('preview of a theme missing a pool falls back and names the level', async () => {
  const id = await idOf('cyber-heist');
  const d = (await as('get', `/api/admin/themes/${id}`)).body;
  const { caesarWords, ...pools } = d.theme.pools;
  expect(caesarWords.length).toBeGreaterThan(0);
  expect((await as('put', `/api/admin/themes/${id}`, { ...themeFields(d.theme), pools, active: false })).status).toBe(200);
  const res = await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abc' });
  expect(res.body).toMatchObject({ usedFallback: true, failure: { order: 2, reason: expect.any(String) } });
  expect(res.body.levels[0].answer).toBe('9742');
});

test('preview saves nothing', async () => {
  const id = await idOf('pirate');
  const before = (await Theme.findById(id)).updatedAt;
  await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abc' });
  expect(await Challenge.countDocuments()).toBe(0);
  expect(await Attempt.countDocuments()).toBe(0);
  expect((await Theme.findById(id)).updatedAt).toEqual(before);
});

test('preview of a deleted theme → 409 THEME_DELETED; a bad seed → 400 on field seed', async () => {
  const id = await idOf('pirate');
  const bad = await as('post', `/api/admin/themes/${id}/preview`, { seed: 'a b' });
  expect([bad.status, bad.body.details[0].field]).toEqual([400, 'seed']);
  await as('delete', `/api/admin/themes/${id}`);
  const res = await as('post', `/api/admin/themes/${id}/preview`, { seed: 'abc' });
  expect([res.status, res.body.error]).toEqual([409, 'THEME_DELETED']);
});
