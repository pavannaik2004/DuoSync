const Attempt = require('../src/models/Attempt');
const { markAway, markBack, resumeClock, awayPlayers } = require('../src/services/pauseService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { startedAttemptDoc, T, MIN } = require('./helpers/attempts');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const BUDGET = { budgetMs: 180000 };
const ENDS = T + 15 * MIN;
const t0 = T + 2 * MIN;

test('the first away player stops the clock; the second does not stop it again', async () => {
  const { _id: id } = await startedAttemptDoc();
  const first = await markAway(id, 'p1', t0, BUDGET);
  expect(first.clockStopped).toBe(true);
  expect(first.attempt.status).toBe('paused');
  expect(first.attempt.pausedAt).toEqual(new Date(t0));
  const second = await markAway(id, 'p2', t0 + 5000, BUDGET);
  expect(second.clockStopped).toBe(false);
  expect(second.attempt.pausedAt).toEqual(new Date(t0));
  expect(awayPlayers(second.attempt).map((p) => p.id)).toEqual(['p1', 'p2']);
});

test('marking the same player away twice is a no-op the second time', async () => {
  const { _id: id } = await startedAttemptDoc();
  await markAway(id, 'p1', t0, BUDGET);
  expect(await markAway(id, 'p1', t0 + 1000, BUDGET)).toBeNull();
  expect((await Attempt.findById(id)).players[0].awaySince).toEqual(new Date(t0));
});

test('markBack resumes only when nobody else is away, extending endsAt by the stopped time', async () => {
  const { _id: id } = await startedAttemptDoc();
  await markAway(id, 'p1', t0, BUDGET);
  await markAway(id, 'p2', t0, BUDGET);
  const half = await markBack(id, 'p2', t0 + 10000, BUDGET);
  expect(half.resumed).toBe(false);
  expect(half.attempt.status).toBe('paused');
  const resumed = await markBack(id, 'p1', t0 + 20000, BUDGET);
  expect(resumed.resumed).toBe(true);
  expect(resumed.attempt.status).toBe('in_progress');
  expect(resumed.attempt.pausedAt).toBeNull();
  expect(resumed.attempt.endsAt.getTime()).toBe(ENDS + 20000);
  expect(resumed.attempt.pauseUsedMs).toBe(20000);
  expect(resumed.attempt.levels[0].pausedMs).toBe(20000);
});

test('markBack for a player who is not away returns null', async () => {
  const { _id: id } = await startedAttemptDoc();
  expect(await markBack(id, 'p1', t0, BUDGET)).toBeNull();
});

test('with no budget left, a disconnect marks the player away but keeps the clock running', async () => {
  const { _id: id } = await startedAttemptDoc({ pauseUsedMs: 180000 });
  const r = await markAway(id, 'p1', t0, BUDGET);
  expect(r.clockStopped).toBe(false);
  expect(r.attempt.status).toBe('in_progress');
  expect(r.attempt.players[0].awaySince).toEqual(new Date(t0));
});

test('Review Focus 2: resumeClock after the budget runs out folds exactly the budget', async () => {
  const { _id: id } = await startedAttemptDoc({ pauseUsedMs: 170000 });
  await markAway(id, 'p1', t0, BUDGET);
  const r = await resumeClock(id, t0 + 25000, BUDGET);
  expect(r.status).toBe('in_progress');
  expect(r.pauseUsedMs).toBe(180000);
  expect(r.endsAt.getTime()).toBe(ENDS + 10000);
  expect(r.levels[0].pausedMs).toBe(10000);
  // The player is still away: the grace continues while the clock runs.
  expect(r.players[0].awaySince).toEqual(new Date(t0));
});

test('two resumeClock calls for one pause fold it once', async () => {
  const { _id: id } = await startedAttemptDoc();
  await markAway(id, 'p1', t0, BUDGET);
  const results = await Promise.all([resumeClock(id, t0 + 5000, BUDGET), resumeClock(id, t0 + 5000, BUDGET)]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await Attempt.findById(id)).pauseUsedMs).toBe(5000);
});

test('markAway on a finished attempt returns null', async () => {
  const { _id: id } = await startedAttemptDoc({ status: 'finished' });
  expect(await markAway(id, 'p1', t0, BUDGET)).toBeNull();
});

test('markAway in the lobby returns null', async () => {
  const { _id: id } = await startedAttemptDoc({ status: 'lobby' });
  expect(await markAway(id, 'p1', t0, BUDGET)).toBeNull();
});
