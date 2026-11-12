const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Attempt = require('../src/models/Attempt');
const Team = require('../src/models/Team');
const { rankCompare } = require('../src/services/scoring');
const { leaderboardFor, rankOf } = require('../src/services/leaderboardService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { challengeDoc, entryDoc, HOUR } = require('./helpers/attempts');
const { createPlayer, createGuest } = require('./helpers/users');
const { expectNoAnswers } = require('./helpers/leaks');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const at = (s) => new Date(Date.UTC(2026, 10, 12, 10, 0, s));
const result = (points, levels, timeS, finishS, over = {}) => ({
  status: 'finished', totalPoints: points, levelsCleared: levels, timeUsedMs: timeS * 1000, finishedAt: at(finishS), stars: levels === 5 ? 1 : 0, ...over,
});

test('rankCompare follows §7.3: points, then levels, then less time, then earlier finish', () => {
  const base = { totalPoints: 300, levelsCleared: 5, timeUsedMs: 600000, finishedAt: new Date(1000) };
  expect(rankCompare({ ...base, totalPoints: 301 }, base)).toBeLessThan(0);
  expect(rankCompare({ ...base, levelsCleared: 4 }, base)).toBeGreaterThan(0);
  expect(rankCompare({ ...base, timeUsedMs: 500000 }, base)).toBeLessThan(0);
  expect(rankCompare({ ...base, finishedAt: new Date(900) }, base)).toBeLessThan(0);
  expect(rankCompare(base, { ...base })).toBe(0);
});

test('the leaderboard ranks final attempts, lists playing and waiting teams, and is provisional while open', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Low', result(150, 3, 900, 30, { status: 'timed_out' }));
  await entryDoc(c, 'High', result(480, 5, 600, 20));
  await entryDoc(c, 'Mid', result(300, 4, 700, 10, { status: 'ended_early' }));
  await entryDoc(c, 'Busy', { status: 'in_progress', levelsCleared: 2 });
  await entryDoc(c, 'Stalled', { status: 'paused', levelsCleared: 0 });
  await entryDoc(c, 'Idle', { status: 'entered' });
  const board = await leaderboardFor(c._id, Date.now());
  expect(board.ranked.map((r) => r.teamName)).toEqual(['High', 'Mid', 'Low']);
  expect(board.ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  expect(board.ranked[0]).toMatchObject({ points: 480, levelsCleared: 5, timeUsedMs: 600000, stars: 1, status: 'finished' });
  expect(board.playing).toEqual(expect.arrayContaining([
    expect.objectContaining({ teamName: 'Busy', levelReached: 3, paused: false }),
    expect.objectContaining({ teamName: 'Stalled', levelReached: 1, paused: true }),
  ]));
  expect(board.playing).toHaveLength(2);
  expect(board.waiting).toEqual([expect.objectContaining({ teamName: 'Idle', didNotStart: false })]);
  expect(board).toMatchObject({ challengeId: String(c._id), status: 'open', provisional: true });
});

test('Review Focus 4: exact ties share a rank; 0 points ranks last', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'Zero', result(0, 0, 100, 1, { status: 'ended_early' }));
  const { attempt: tieA } = await entryDoc(c, 'TieA', result(400, 5, 600, 50));
  const { attempt: tieB } = await entryDoc(c, 'TieB', result(400, 5, 600, 50));
  const board = await leaderboardFor(c._id, Date.now());
  expect(board.ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  expect(board.ranked[2].teamName).toBe('Zero');
  await expect(rankOf(tieB)).resolves.toEqual({ position: 1, outOf: 3, provisional: true });
  await expect(rankOf(tieA)).resolves.toEqual({ position: 1, outOf: 3, provisional: true });
  const zero = await Attempt.findOne({ teamId: (await Team.findOne({ name: 'Zero' }))._id });
  await expect(rankOf(zero)).resolves.toEqual({ position: 3, outOf: 3, provisional: true });
});

test('rankOf uses each §7.3 key in order', async () => {
  const c = await challengeDoc();
  const { attempt: slow } = await entryDoc(c, 'Slow', result(400, 5, 700, 1));
  const { attempt: late } = await entryDoc(c, 'Late', result(400, 5, 600, 90));
  const { attempt: early } = await entryDoc(c, 'Early', result(400, 5, 600, 30));
  const { attempt: fewer } = await entryDoc(c, 'Fewer', result(400, 4, 100, 1, { status: 'ended_early' }));
  const positions = await Promise.all([early, late, slow, fewer].map(async (a) => (await rankOf(a)).position));
  expect(positions).toEqual([1, 2, 3, 4]);
});

test('rankOf is null for practice and for unfinished attempts', async () => {
  const c = await challengeDoc();
  const { attempt: playing } = await entryDoc(c, 'Busy', { status: 'in_progress' });
  expect(await rankOf(playing)).toBeNull();
  expect(await rankOf({ challengeId: null, status: 'finished' })).toBeNull();
});

test('after the window and every attempt end, waiting teams did not start and the board is final', async () => {
  const c = await challengeDoc({ startsAt: new Date(Date.now() - 3 * HOUR), endsAt: new Date(Date.now() - HOUR) });
  const { attempt } = await entryDoc(c, 'Done', result(200, 2, 900, 5, { status: 'timed_out' }));
  await entryDoc(c, 'Never', { status: 'entered' });
  const board = await leaderboardFor(c._id, Date.now());
  expect(board).toMatchObject({ status: 'closed', provisional: false });
  expect(board.waiting).toEqual([expect.objectContaining({ teamName: 'Never', didNotStart: true })]);
  await expect(rankOf(attempt)).resolves.toEqual({ position: 1, outOf: 1, provisional: false });
});

test('a closing challenge is still provisional', async () => {
  const c = await challengeDoc({ startsAt: new Date(Date.now() - 3 * HOUR), endsAt: new Date(Date.now() - HOUR) });
  await entryDoc(c, 'Late Runner', { status: 'in_progress', levelsCleared: 4 });
  const board = await leaderboardFor(c._id, Date.now());
  expect(board).toMatchObject({ status: 'closing', provisional: true });
});

test('the payload carries only leaderboard fields (NFR-1, NFR-4)', async () => {
  const c = await challengeDoc();
  await entryDoc(c, 'High', result(480, 5, 600, 20));
  await entryDoc(c, 'Busy', { status: 'in_progress', levelsCleared: 2 });
  const board = await leaderboardFor(c._id, Date.now());
  expect(Object.keys(board.ranked[0]).sort()).toEqual(['finishedAt', 'levelsCleared', 'points', 'rank', 'stars', 'status', 'teamId', 'teamName', 'timeUsedMs']);
  expect(Object.keys(board.playing[0]).sort()).toEqual(['levelReached', 'paused', 'teamId', 'teamName']);
  expectNoAnswers(board, c.levels);
});

test('NFR-11: a 100-team leaderboard loads in under 1 second', async () => {
  const c = await challengeDoc();
  const teams = Array.from({ length: 100 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(), name: `Team ${i}`, captainId: new mongoose.Types.ObjectId(),
  }));
  await Team.insertMany(teams);
  await Attempt.insertMany(teams.map((t, i) => ({
    challengeId: c._id, teamId: t._id, memberIds: [t.captainId], themeSlug: c.themeSlug, theme: c.theme,
    players: [{ id: String(t.captainId), kind: 'user', name: `p${i}` }], ...result(i * 4, i % 6, 600 + i, i),
  })));
  const player = await createPlayer(app, 'viewer');
  const started = Date.now();
  const res = await request(app).get(`/api/challenges/${c._id}/leaderboard`).set('Authorization', player.auth);
  const elapsed = Date.now() - started;
  expect(res.status).toBe(200);
  expect(res.body.ranked).toHaveLength(100);
  expect(res.body.ranked[0].points).toBe(396);
  expect(elapsed).toBeLessThan(1000);
});

test('GET /leaderboard refuses guests and unknown ids', async () => {
  const c = await challengeDoc();
  const guest = await createGuest(app);
  expect((await request(app).get(`/api/challenges/${c._id}/leaderboard`).set('Authorization', guest.auth)).body.error).toBe('GUEST_NOT_ALLOWED');
  const player = await createPlayer(app, 'viewer');
  const missing = await request(app).get(`/api/challenges/${new mongoose.Types.ObjectId()}/leaderboard`).set('Authorization', player.auth);
  expect(missing.status).toBe(404);
  expect(missing.body.error).toBe('CHALLENGE_NOT_FOUND');
  const garbage = await request(app).get('/api/challenges/not-an-id/leaderboard').set('Authorization', player.auth);
  expect(garbage.status).toBe(404);
});
