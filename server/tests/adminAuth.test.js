/** ADMIN-1 / NFR-3: every /api/admin route refuses anyone who is not an admin. Tasks 2–5 add their routes here. */
const request = require('supertest');
const { createApp } = require('../src/app');
const Theme = require('../src/models/Theme');
const LevelTemplate = require('../src/models/LevelTemplate');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createGuest, createOrganizer } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
beforeEach(async () => { await clearDb(); await seedThemes(); });
afterAll(stopDb);

const ROUTES = [
  ['get', '/api/admin/themes'],
  ['post', '/api/admin/themes'],
  ['get', '/api/admin/themes/:id'],
  ['put', '/api/admin/themes/:id'],
  ['delete', '/api/admin/themes/:id'],
];

test.each(ROUTES)('%s %s: 401 anon, 403 guest, 403 player, 403 organizer', async (method, path) => {
  const theme = await Theme.findOne({ slug: 'pirate' });
  const level = await LevelTemplate.findOne({ themeId: theme._id, order: 1 });
  const player = await createPlayer(app, 'plain1');
  const url = path.replace(':id', String(theme._id)).replace(':levelId', String(level._id)).replace(':userId', player.user.id);
  const guest = await createGuest(app);
  const organizer = await createOrganizer(app, 'org1');
  const call = (auth) => {
    const req = request(app)[method](url).send({});
    return auth ? req.set('Authorization', auth) : req;
  };
  const anon = await call(null);
  expect([anon.status, anon.body.error]).toEqual([401, 'AUTH_REQUIRED']);
  const g = await call(guest.auth);
  expect([g.status, g.body.error]).toEqual([403, 'GUEST_NOT_ALLOWED']);
  for (const who of [player, organizer]) {
    const res = await call(who.auth);
    expect([res.status, res.body.error]).toEqual([403, 'FORBIDDEN']);
  }
  expect(await Theme.countDocuments()).toBe(8);
  expect((await Theme.findOne({ slug: 'pirate' })).deletedAt).toBeNull();
});
