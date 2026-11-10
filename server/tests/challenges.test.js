const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Challenge = require('../src/models/Challenge');
const Attempt = require('../src/models/Attempt');
const User = require('../src/models/User');
const { statusOf } = require('../src/services/challengeService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

beforeAll(startDb);
beforeEach(seedThemes);
afterEach(clearDb);
afterAll(stopDb);

const body = (over = {}) => {
  const now = Date.now();
  return {
    name: 'Friday Heist', theme: 'cyber-heist', visibility: 'private',
    startsAt: new Date(now + HOUR).toISOString(), endsAt: new Date(now + 3 * HOUR).toISOString(), ...over,
  };
};
const create = (auth, over) => request(app).post('/api/challenges').set('Authorization', auth).send(body(over));
const view = (auth, code) => request(app).get(`/api/challenges/${code}`).set('Authorization', auth);
const newId = () => new mongoose.Types.ObjectId();

test('a player creates a private challenge: 201, 6-character code, 5 levels saved with a seed', async () => {
  const alice = await createPlayer(app, 'alice');
  const res = await create(alice.auth);
  expect(res.status).toBe(201);
  expect(res.body.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  const doc = await Challenge.findOne({ code: res.body.code });
  expect(doc.levels).toHaveLength(5);
  expect(doc.seed).toMatch(/^[0-9a-f]{16}$/);
  expect(doc.theme.slug).toBe('cyber-heist');
  expect(doc.levels[0].solvedAt).toBeUndefined();
});

test('the challenge page never contains an answer, a clue, the seed or a solution (NFR-1)', async () => {
  const alice = await createPlayer(app, 'alice');
  const created = await create(alice.auth);
  const page = await view(alice.auth, created.body.code.toLowerCase());
  expect(page.status).toBe(200);
  expect(page.body).toMatchObject({ code: created.body.code, name: 'Friday Heist', status: 'upcoming', isCreator: true, teamsEntered: 0, myEntry: null, maxTeams: null });
  expect(page.body.theme.slug).toBe('cyber-heist');
  const doc = await Challenge.findOne({ code: created.body.code });
  const json = JSON.stringify(page.body);
  for (const l of doc.levels) expect(json).not.toContain(l.answer.length >= 3 ? l.answer : '\u0000');
  expect(json).not.toMatch(/clueA|clueB|seed|solution|explanation|levels|usedFallback/);
});

test('a malformed or unknown code is 404 CHALLENGE_NOT_FOUND', async () => {
  const alice = await createPlayer(app, 'alice');
  for (const code of ['abc', 'AAAAAA']) {
    const res = await view(alice.auth, code);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('CHALLENGE_NOT_FOUND');
  }
});

test('a player gets 403 PUBLIC_NEEDS_ORGANIZER for public; an organizer may', async () => {
  const alice = await createPlayer(app, 'alice');
  const res = await create(alice.auth, { visibility: 'public' });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('PUBLIC_NEEDS_ORGANIZER');
  await User.updateOne({ _id: alice.user.id }, { roles: ['player', 'organizer'] });
  expect((await create(alice.auth, { visibility: 'public' })).status).toBe(201);
});

test.each([
  ['end 14 minutes after start', 14 * MIN], ['end 31 days after start', 31 * DAY],
])('rejects a window with %s', async (_, length) => {
  const alice = await createPlayer(app, 'alice');
  const start = Date.now() + HOUR;
  const res = await create(alice.auth, { startsAt: new Date(start).toISOString(), endsAt: new Date(start + length).toISOString() });
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('VALIDATION_ERROR');
});

test('rejects a start in the past, bad dates, a bad name and a bad maxTeams', async () => {
  const alice = await createPlayer(app, 'alice');
  const past = Date.now() - 10 * MIN;
  expect((await create(alice.auth, { startsAt: new Date(past).toISOString(), endsAt: new Date(past + HOUR).toISOString() })).body.error).toBe('VALIDATION_ERROR');
  expect((await create(alice.auth, { startsAt: 'tomorrow' })).body.error).toBe('VALIDATION_ERROR');
  expect((await create(alice.auth, { name: 'x' })).body.error).toBe('VALIDATION_ERROR');
  expect((await create(alice.auth, { maxTeams: 1 })).body.error).toBe('VALIDATION_ERROR');
  expect((await create(alice.auth, { maxTeams: 501 })).body.error).toBe('VALIDATION_ERROR');
  expect((await create(alice.auth, { maxTeams: 10 })).status).toBe(201);
});

test('an unknown theme is 404 THEME_NOT_FOUND', async () => {
  const alice = await createPlayer(app, 'alice');
  const res = await create(alice.auth, { theme: 'no-such-theme' });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('THEME_NOT_FOUND');
});

test('a guest gets 403 GUEST_NOT_ALLOWED on every challenge route', async () => {
  const guest = await createGuest(app);
  const calls = [
    request(app).post('/api/challenges').set('Authorization', guest.auth).send(body()),
    request(app).get('/api/challenges/ABCDEF').set('Authorization', guest.auth),
    request(app).patch('/api/challenges/abc').set('Authorization', guest.auth).send({}),
    request(app).delete('/api/challenges/abc').set('Authorization', guest.auth),
  ];
  for (const res of await Promise.all(calls)) {
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('GUEST_NOT_ALLOWED');
  }
});

test('two challenges of one theme have different seeds and levels', async () => {
  const alice = await createPlayer(app, 'alice');
  const a = await Challenge.findOne({ code: (await create(alice.auth)).body.code });
  const b = await Challenge.findOne({ code: (await create(alice.auth)).body.code });
  expect(a.seed).not.toBe(b.seed);
  expect(a.levels.map((l) => l.answer)).not.toEqual(b.levels.map((l) => l.answer));
});

test('the creator edits the name before the start; after the start is 409 CHALLENGE_STARTED; another player is 403', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const { body: made } = await create(alice.auth);
  const patch = (auth, data) => request(app).patch(`/api/challenges/${made.id}`).set('Authorization', auth).send(data);

  expect((await patch(alice.auth, { name: 'Renamed Run' })).status).toBe(204);
  expect((await Challenge.findById(made.id)).name).toBe('Renamed Run');

  const other = await patch(bob.auth, { name: 'Hijack' });
  expect(other.status).toBe(403);
  expect(other.body.error).toBe('NOT_CREATOR');

  await Challenge.updateOne({ _id: made.id }, { startsAt: new Date(Date.now() - MIN) });
  const late = await patch(alice.auth, { name: 'Too Late' });
  expect(late.status).toBe(409);
  expect(late.body.error).toBe('CHALLENGE_STARTED');
});

test('edits re-check the window, and maxTeams cannot drop below the entries', async () => {
  const alice = await createPlayer(app, 'alice');
  const { body: made } = await create(alice.auth, { maxTeams: 10 });
  const patch = (data) => request(app).patch(`/api/challenges/${made.id}`).set('Authorization', alice.auth).send(data);
  const doc = await Challenge.findById(made.id);

  expect((await patch({ endsAt: new Date(doc.startsAt.getTime() + 5 * MIN).toISOString() })).body.error).toBe('VALIDATION_ERROR');
  expect((await patch({ maxTeams: 1 })).body.error).toBe('VALIDATION_ERROR');

  await Attempt.create({ challengeId: made.id, themeSlug: 'cyber-heist', teamId: newId() });
  await Attempt.create({ challengeId: made.id, themeSlug: 'cyber-heist', teamId: newId() });
  expect((await patch({ maxTeams: 2 })).status).toBe(204);
  await Attempt.create({ challengeId: made.id, themeSlug: 'cyber-heist', teamId: newId() });
  const tooLow = await patch({ maxTeams: 2 });
  expect(tooLow.status).toBe(409);
  expect(tooLow.body.error).toBe('MAX_TEAMS_TOO_LOW');
  expect((await patch({ maxTeams: null })).status).toBe(204);
});

test('delete works with no entries; HAS_ENTRIES once a team has entered', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const del = (auth, id) => request(app).delete(`/api/challenges/${id}`).set('Authorization', auth);
  const { body: empty } = await create(alice.auth);
  expect((await del(bob.auth, empty.id)).body.error).toBe('NOT_CREATOR');
  expect((await del(alice.auth, empty.id)).status).toBe(204);
  expect(await Challenge.findById(empty.id)).toBeNull();

  const { body: entered } = await create(alice.auth);
  await Attempt.create({ challengeId: entered.id, themeSlug: 'cyber-heist' });
  const res = await del(alice.auth, entered.id);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('HAS_ENTRIES');
  expect(await Challenge.findById(entered.id)).not.toBeNull();
});

test('the view counts entries and shows my team entry', async () => {
  const alice = await createPlayer(app, 'alice');
  const { body: made } = await create(alice.auth);
  const team = await request(app).post('/api/teams').set('Authorization', alice.auth).send({ name: 'Foxes' });
  const attempt = await Attempt.create({ challengeId: made.id, teamId: team.body.id, themeSlug: 'cyber-heist' });
  const page = await view(alice.auth, made.code);
  expect(page.body.teamsEntered).toBe(1);
  expect(page.body.myEntry).toEqual({ attemptId: String(attempt._id), teamId: team.body.id, teamName: 'Foxes', status: 'entered' });
});

test('status is upcoming, then open, then closed as the clock passes the window', () => {
  const c = { startsAt: new Date(HOUR), endsAt: new Date(2 * HOUR) };
  expect(statusOf(c, 0, false)).toBe('upcoming');
  expect(statusOf(c, c.startsAt.getTime(), false)).toBe('open');
  expect(statusOf(c, c.endsAt.getTime() - 1, false)).toBe('open');
  expect(statusOf(c, c.endsAt.getTime(), true)).toBe('closing');
  expect(statusOf(c, c.endsAt.getTime(), false)).toBe('closed');
});
