/** CHAL-4 / D91: the public challenges list with its filter form. */
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const Challenge = require('../src/models/Challenge');
const Attempt = require('../src/models/Attempt');
const { generateCode } = require('../src/services/codeService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const HOUR = 3600000;
let player;
let n = 0;

beforeAll(startDb);
beforeEach(async () => {
  await clearDb();
  player = await createPlayer(app, 'alice');
});
afterAll(stopDb);

const THEMES = { 'cyber-heist': 'Cyber Heist – Operation Blackout', pirate: "Pirate – Blackbeard's Lost Treasure" };

/** A challenge straight in the DB; start and end are hours from now. */
async function make({ visibility = 'public', start = -1, end = 2, theme = 'cyber-heist', name } = {}) {
  n += 1;
  const now = Date.now();
  return Challenge.create({
    code: generateCode(6),
    name: name || `Challenge ${n}`,
    themeSlug: theme,
    theme: { slug: theme, name: THEMES[theme] },
    creatorId: new mongoose.Types.ObjectId(),
    visibility,
    startsAt: new Date(now + start * HOUR),
    endsAt: new Date(now + end * HOUR),
    seed: 'seed',
    levels: [],
  });
}

const enter = (challenge, status = 'entered') => Attempt.create({
  challengeId: challenge._id,
  teamId: new mongoose.Types.ObjectId(),
  memberIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
  themeSlug: challenge.themeSlug,
  status,
});

const list = (query = '', auth = player.auth) => request(app).get(`/api/challenges${query}`).set('Authorization', auth);

test('only public challenges are listed, with the row fields', async () => {
  const pub = await make({ name: 'Open Cup' });
  await make({ visibility: 'private' });
  await enter(pub);
  await enter(pub);
  const res = await list();
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
  expect(res.body.items).toEqual([{
    id: String(pub._id),
    code: pub.code,
    name: 'Open Cup',
    theme: { slug: 'cyber-heist', name: THEMES['cyber-heist'] },
    startsAt: pub.startsAt.toISOString(),
    endsAt: pub.endsAt.toISOString(),
    status: 'open',
    teamsEntered: 2,
  }]);
});

test.each([
  ['upcoming', ['Soon']],
  ['open', ['Now']],
  ['closed', ['Done']],
  ['all', ['Soon', 'Now', 'Done']],
])('status=%s filters by the window', async (status, names) => {
  await make({ name: 'Soon', start: 1, end: 3 });
  await make({ name: 'Now', start: -1, end: 1 });
  await make({ name: 'Done', start: -3, end: -1 });
  const res = await list(`?status=${status}`);
  expect(res.body.items.map((c) => c.name).sort()).toEqual([...names].sort());
});

test('a closed window with a running attempt is listed under closed with status closing', async () => {
  const late = await make({ name: 'Late', start: -3, end: -1 });
  await enter(late, 'in_progress');
  const res = await list('?status=closed');
  expect(res.body.items.map((c) => [c.name, c.status])).toEqual([['Late', 'closing']]);
});

test('theme filter', async () => {
  await make({ name: 'Heist' });
  await make({ name: 'Pirates', theme: 'pirate' });
  expect((await list('?theme=pirate')).body.items.map((c) => c.name)).toEqual(['Pirates']);
});

test('paging: 25 challenges give 20 then 5; page past the end is empty', async () => {
  for (let i = 0; i < 25; i += 1) await make();
  const p1 = (await list('?page=1')).body;
  const p2 = (await list('?page=2')).body;
  expect([p1.items.length, p1.total, p2.items.length, p2.page]).toEqual([20, 25, 5, 2]);
  expect(new Set([...p1.items, ...p2.items].map((c) => c.id)).size).toBe(25);
  expect((await list('?page=3')).body.items).toEqual([]);
});

test.each(['?page=0', '?page=x', '?status=soon', '?theme=Bad Theme'])('%s → 400', async (q) => {
  const res = await list(q);
  expect([res.status, res.body.error]).toEqual([400, 'VALIDATION_ERROR']);
});

test('upcoming is sorted soonest first; the rest by newest start', async () => {
  await make({ name: 'Later', start: 5, end: 6 });
  await make({ name: 'Sooner', start: 1, end: 2 });
  await make({ name: 'Old', start: -5, end: -4 });
  await make({ name: 'Recent', start: -2, end: -1 });
  expect((await list('?status=upcoming')).body.items.map((c) => c.name)).toEqual(['Sooner', 'Later']);
  expect((await list('?status=closed')).body.items.map((c) => c.name)).toEqual(['Recent', 'Old']);
  expect((await list()).body.items.map((c) => c.name)).toEqual(['Later', 'Sooner', 'Recent', 'Old']);
});

test('a guest may list; the rows carry no levels, seed or answers; no token → 401', async () => {
  await make();
  const guest = await createGuest(app);
  const res = await list('', guest.auth);
  expect(res.status).toBe(200);
  expect(JSON.stringify(res.body)).not.toMatch(/levels|seed|answer|fallback|solution|creatorId/);
  expect((await request(app).get('/api/challenges')).status).toBe(401);
});
