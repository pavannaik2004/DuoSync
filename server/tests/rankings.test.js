const request = require('supertest');
const { createApp } = require('../src/app');
const Attempt = require('../src/models/Attempt');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { challengeDoc, entryDoc, MIN } = require('./helpers/attempts');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
beforeEach(seedThemes);
afterEach(clearDb);
afterAll(stopDb);

let alice;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
});

const rankings = (slug, auth = alice.auth) => request(app).get(`/api/themes/${slug}/rankings`).set('Authorization', auth);
const at = (n) => new Date(Date.UTC(2026, 10, 1, 12, n));
const result = (points, levels, timeMin, n = 0) => ({
  status: 'finished', totalPoints: points, levelsCleared: levels, timeUsedMs: timeMin * MIN, finishedAt: at(n), stars: 1,
});

/** A second run for an existing team in a new challenge. */
async function againIn(challenge, entry, fields) {
  return Attempt.create({
    challengeId: challenge._id,
    teamId: entry.team._id,
    memberIds: entry.team.memberIds,
    players: entry.attempt.players.map((p) => p.toObject()),
    themeSlug: challenge.themeSlug,
    theme: challenge.theme,
    ...fields,
  });
}

test('SCORE-6: a team with several runs appears once, with its best by §7.3', async () => {
  const c1 = await challengeDoc({ name: 'First Run' });
  const c2 = await challengeDoc({ name: 'Second Run' });
  const c3 = await challengeDoc({ name: 'Third Run' });
  const owls = await entryDoc(c1, 'Owls', result(300, 4, 10));
  await againIn(c2, owls, result(300, 5, 12)); // same points, more levels → better
  await againIn(c3, owls, result(250, 5, 5));
  const res = await rankings('cyber-heist');
  expect(res.status).toBe(200);
  expect(res.body.theme).toEqual({ slug: 'cyber-heist', name: expect.any(String) });
  expect(res.body.rows).toHaveLength(1);
  expect(res.body.rows[0]).toMatchObject({ rank: 1, teamName: 'Owls', points: 300, levelsCleared: 5, challengeName: 'Second Run' });
});

test('SCORE-6: equal points and levels → less time ranks first', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Slow', result(200, 3, 14));
  await entryDoc(c, 'Fast', result(200, 3, 9));
  await entryDoc(c, 'Top', result(400, 5, 15));
  const { body } = await rankings('cyber-heist');
  expect(body.rows.map((r) => [r.rank, r.teamName])).toEqual([[1, 'Top'], [2, 'Fast'], [3, 'Slow']]);
});

test('SCORE-6: practice and unfinished attempts never count', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Playing', { status: 'in_progress', totalPoints: 900, levelsCleared: 4 });
  await entryDoc(c, 'Waiting', { status: 'entered' });
  const done = await entryDoc(c, 'Done', result(100, 2, 10));
  await Attempt.create({
    teamId: null, practiceCode: 'PRAC22', themeSlug: 'cyber-heist', theme: done.attempt.theme, players: done.attempt.players.map((p) => p.toObject()),
    ...result(999, 5, 1),
  });
  const { body } = await rankings('cyber-heist');
  expect(body.rows.map((r) => r.teamName)).toEqual(['Done']);
});

test('SCORE-6: teams equal on all four §7.3 keys share a rank', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Ann', result(200, 3, 9, 1));
  await entryDoc(c, 'Ben', result(200, 3, 9, 1));
  await entryDoc(c, 'Cal', result(100, 3, 9, 1));
  const { body } = await rankings('cyber-heist');
  expect(body.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
});

test('SCORE-6: rows carry only the named fields (NFR-1)', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Owls', result(300, 5, 10));
  const { body } = await rankings('cyber-heist');
  expect(Object.keys(body.rows[0]).sort()).toEqual(
    ['challengeName', 'levelsCleared', 'playedAt', 'points', 'rank', 'stars', 'teamId', 'teamName', 'timeUsedMs'],
  );
  const text = JSON.stringify(body);
  for (const word of ['answer', 'memberIds', 'seed', 'levels"', 'players']) expect(text).not.toContain(word);
});

test('SCORE-6: at most 20 rows', async () => {
  const c = await challengeDoc();
  for (let i = 0; i < 22; i += 1) await entryDoc(c, `Team ${String(i).padStart(2, '0')}`, result(100 + i, 3, 10));
  const { body } = await rankings('cyber-heist');
  expect(body.rows).toHaveLength(20);
  expect(body.rows[0].teamName).toBe('Team 21');
});

test('SCORE-6: unknown slug → 200 with no theme and no rows; bad slug → 400; guest → 403', async () => {
  expect((await rankings('no-such-theme')).body).toEqual({ theme: null, rows: [] });
  const bad = await rankings('A%20B');
  expect(bad.status).toBe(400);
  const guest = await createGuest(app);
  expect((await rankings('cyber-heist', guest.auth)).status).toBe(403);
});
