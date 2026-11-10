const request = require('supertest');
const { createApp } = require('../src/app');
const Theme = require('../src/models/Theme');
const LevelTemplate = require('../src/models/LevelTemplate');
const { ensureSeeded, seedThemes, loadThemeContent } = require('../src/services/themeService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
beforeEach(clearDb);
afterAll(stopDb);

test('ensureSeeded inserts 8 themes and 40 templates once; a second call changes nothing', async () => {
  await ensureSeeded();
  expect(await Theme.countDocuments()).toBe(8);
  expect(await LevelTemplate.countDocuments()).toBe(40);
  await Theme.updateOne({ slug: 'pirate' }, { story: 'edited' });
  await ensureSeeded();
  expect(await Theme.countDocuments()).toBe(8);
  expect(await LevelTemplate.countDocuments()).toBe(40);
  expect((await Theme.findOne({ slug: 'pirate' })).story).toBe('edited');
});

test('ensureSeeded does not overwrite an edited theme; seedThemes({ overwrite: true }) does', async () => {
  await ensureSeeded();
  await Theme.updateOne({ slug: 'pirate' }, { name: 'Edited' });
  await LevelTemplate.updateMany({}, { title: 'Edited level' });
  await ensureSeeded();
  expect((await Theme.findOne({ slug: 'pirate' })).name).toBe('Edited');
  expect(await seedThemes({ overwrite: true })).toEqual({ created: 0, updated: 8 });
  expect((await Theme.findOne({ slug: 'pirate' })).name).toMatch(/Blackbeard/);
  expect(await LevelTemplate.countDocuments({ title: 'Edited level' })).toBe(0);
  expect(await LevelTemplate.countDocuments()).toBe(40);
});

test('GET /api/themes lists the 8 active themes, without pools or templates; a guest may call it', async () => {
  await ensureSeeded();
  const guest = await createGuest(app);
  const res = await request(app).get('/api/themes').set('Authorization', guest.auth);
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(8);
  const pirate = res.body.find((t) => t.slug === 'pirate');
  expect(Object.keys(pirate).sort()).toEqual(['genre', 'name', 'roles', 'slug', 'story', 'styleKey', 'timerMinutes']);
  expect(pirate.timerMinutes).toBe(18);
  expect(JSON.stringify(res.body)).not.toMatch(/pools|templates|solution|fallback/);
  const player = await createPlayer(app, 'alice');
  expect((await request(app).get('/api/themes').set('Authorization', player.auth)).status).toBe(200);
  expect((await request(app).get('/api/themes')).status).toBe(401);
});

test('an inactive theme is not listed and loadThemeContent rejects it with THEME_NOT_FOUND', async () => {
  await ensureSeeded();
  await Theme.updateOne({ slug: 'pirate' }, { active: false });
  await Theme.updateOne({ slug: 'detective' }, { deletedAt: new Date() });
  const guest = await createGuest(app);
  const res = await request(app).get('/api/themes').set('Authorization', guest.auth);
  expect(res.body.map((t) => t.slug)).not.toEqual(expect.arrayContaining(['pirate']));
  expect(res.body).toHaveLength(6);
  await expect(loadThemeContent('pirate')).rejects.toMatchObject({ status: 404, code: 'THEME_NOT_FOUND' });
  await expect(loadThemeContent('detective')).rejects.toMatchObject({ code: 'THEME_NOT_FOUND' });
  await expect(loadThemeContent('missing')).rejects.toMatchObject({ code: 'THEME_NOT_FOUND' });
});

test('loadThemeContent returns a snapshot, 5 templates, pools and fallback levels', async () => {
  await ensureSeeded();
  const c = await loadThemeContent('cyber-heist');
  expect(c.theme).toMatchObject({ slug: 'cyber-heist', timerMinutes: 15 });
  expect(c.templates.map((t) => t.order)).toEqual([1, 2, 3, 4, 5]);
  expect(c.fallbackLevels).toHaveLength(5);
  expect(c.fallbackLevels.map((l) => l.answer)).toEqual(['9742', 'FIREWALL', '23-12-4', '8315', 'NODE']);
});
