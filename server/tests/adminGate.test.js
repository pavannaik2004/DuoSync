/** PRD §11 Phase 5 gate, through the API: a theme built only through the admin routes is used in a public challenge. */
const request = require('supertest');
const { createApp } = require('../src/app');
const Challenge = require('../src/models/Challenge');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createAdmin, createPlayer } = require('./helpers/users');
const { enterTeam } = require('./helpers/rooms');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
beforeEach(async () => { await clearDb(); await seedThemes(); });
afterAll(stopDb);

const LEVEL_KEYS = ['title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];

test('a theme built only through the admin API is used in a public challenge', async () => {
  const admin = await createAdmin(app);
  const as = (method, url, body) => request(app)[method](url).set('Authorization', admin.auth).send(body);

  // 1. pick five examples from the catalog (the cyber-heist ones, in order)
  const catalog = (await as('get', '/api/admin/catalog')).body;
  const pickExample = (mechanic) => catalog.mechanics.find((m) => m.slug === mechanic).examples.find((e) => e.theme === 'cyber-heist');
  const examples = ['decode-key', 'caesar', 'rule-filter', 'describe-match', 'fragment-finale'].map(pickExample);

  // 2. create the theme, add the pools the examples need, then the five levels
  const created = await as('post', '/api/admin/themes', {
    slug: 'test-vault', name: 'The Test Vault', genre: 'Heist', story: 'Two agents, one vault.',
    timerMinutes: 20, styleKey: 'cyber', boardLabel: 'Fragments',
    roles: { A: { name: 'Picker', description: 'Sees the locks.' }, B: { name: 'Reader', description: 'Holds the manuals.' } },
    revealText: 'The vault opens.', failText: 'The alarm sounds.',
  });
  expect(created.status).toBe(201);
  const id = created.body.theme.id;
  const pools = Object.assign({}, ...examples.map((e) => e.pools));
  const { theme } = created.body;
  const themeBody = {
    name: theme.name, genre: theme.genre, story: theme.story, roles: theme.roles, timerMinutes: theme.timerMinutes,
    styleKey: theme.styleKey, boardLabel: theme.boardLabel, revealText: theme.revealText, failText: theme.failText, pools,
  };
  expect((await as('put', `/api/admin/themes/${id}`, themeBody)).status).toBe(200);
  for (const example of examples) {
    const level = Object.fromEntries(LEVEL_KEYS.map((k) => [k, example[k]]));
    const posted = await as('post', `/api/admin/themes/${id}/levels`, level);
    expect([example.title, posted.status, posted.body.details]).toEqual([example.title, 201, undefined]);
  }

  // 3. preview, then activate
  const preview = (await as('post', `/api/admin/themes/${id}/preview`, { seed: 'gate' })).body;
  expect(preview.usedFallback).toBe(false);
  const on = await as('put', `/api/admin/themes/${id}`, { ...themeBody, active: true });
  expect([on.status, on.body.problems]).toEqual([200, []]);

  // 4. the admin makes an organizer, who publishes a public challenge on the new theme
  const org = await createPlayer(app, 'org1');
  expect((await as('patch', `/api/admin/users/${org.user.id}/roles`, { organizer: true })).status).toBe(200);
  const now = Date.now();
  const challenge = await request(app).post('/api/challenges').set('Authorization', org.auth).send({
    name: 'Vault Cup', theme: 'test-vault', visibility: 'public',
    startsAt: new Date(now + 60000).toISOString(), endsAt: new Date(now + 2 * 3600000).toISOString(),
  });
  expect(challenge.status).toBe(201);

  // 5. anyone finds it in the list and the theme catalogue; a team can enter it
  const player = await createPlayer(app, 'alice');
  const themes = (await request(app).get('/api/themes').set('Authorization', player.auth)).body;
  expect(themes.find((t) => t.slug === 'test-vault')).toMatchObject({ name: 'The Test Vault', timerMinutes: 20 });
  const listed = (await request(app).get('/api/challenges?theme=test-vault').set('Authorization', player.auth)).body;
  expect(listed.items.map((c) => [c.name, c.status, c.theme.name])).toEqual([['Vault Cup', 'upcoming', 'The Test Vault']]);
  const saved = await Challenge.findOne({ themeSlug: 'test-vault' });
  expect([saved.usedFallback, saved.levels.length, saved.theme.roles.A.name]).toEqual([false, 5, 'Picker']);
  const { attemptId } = await enterTeam(app, String(saved._id), ['bob', 'carol']);
  expect(attemptId).toEqual(expect.any(String));
});
