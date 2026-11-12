const Attempt = require('../src/models/Attempt');
const { getContent } = require('../src/content');
const { submitAnswer, revealHint, endAttempt } = require('../src/services/gameService');
const { clueFor, toPlayerView } = require('../src/services/attemptView');
const { startDb, clearDb, stopDb } = require('./helpers/db');

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const T = Date.UTC(2026, 10, 12, 10, 0, 0);
const MIN = 60000;
const PLAYER = { id: 'p1', name: 'alice', role: 'A' };

/** A started Cyber Heist attempt: level 1 unlocked at T, a 15-minute timer. */
async function started(over = {}) {
  const { theme, levels } = getContent('cyber-heist');
  return Attempt.create({
    themeSlug: theme.slug,
    theme,
    players: [{ id: 'p1', kind: 'user', name: 'alice', role: 'A' }, { id: 'p2', kind: 'user', name: 'bob', role: 'B' }],
    status: 'in_progress',
    levels: levels.map((l, i) => ({ ...l, unlockedAt: i === 0 ? new Date(T) : null })),
    startedAt: new Date(T),
    endsAt: new Date(T + 15 * MIN),
    ...over,
  });
}

test('§7.3 t excludes paused time: 180 s on the level with a 60 s pause scores as 120 s', async () => {
  const attempt = await started();
  await Attempt.updateOne({ _id: attempt._id }, { $set: { 'levels.0.pausedMs': 60000 } });
  const outcome = await submitAnswer(attempt._id, PLAYER, { order: 1, answer: attempt.levels[0].answer }, T + 180000);
  expect(outcome.kind).toBe('solved');
  expect(outcome.points).toBe(90); // 100 − ⌊(120 − 60) / 6⌋
  expect(outcome.attempt.levels[0].activeMs).toBe(120000);
});

test('§7.5: the hint is not ready until 90 s of active time', async () => {
  const attempt = await started();
  await Attempt.updateOne({ _id: attempt._id }, { $set: { 'levels.0.pausedMs': 30000 } });
  const fresh = await Attempt.findById(attempt._id);
  expect(clueFor(fresh, 'p1', { now: T + 100000 }).hint.ready).toBe(false); // 70 s active
  expect(clueFor(fresh, 'p1', { now: T + 120000 }).hint.ready).toBe(true); // 90 s active
  await expect(revealHint(attempt._id, PLAYER, { order: 1 }, T + 100000)).rejects.toMatchObject({ code: 'HINT_NOT_READY' });
  expect((await revealHint(attempt._id, PLAYER, { order: 1 }, T + 120000)).kind).toBe('revealed');
});

test('a snapshot of a paused attempt shows the time left when it paused', async () => {
  const attempt = await started({ status: 'paused', pausedAt: new Date(T + 5 * MIN) });
  expect(toPlayerView(attempt, 'p1', { now: T + 7 * MIN }).remainingMs).toBe(10 * MIN);
});

test('endAttempt on a paused attempt folds the pause and excludes it from time used', async () => {
  const attempt = await started({ status: 'paused', pausedAt: new Date(T + 200000), pauseUsedMs: 0 });
  const ended = await endAttempt(attempt._id, 'ended_early', T + 260000);
  expect(ended.status).toBe('ended_early');
  expect(ended.timeUsedMs).toBe(200000);
  expect(ended.pauseUsedMs).toBe(60000);
  expect(ended.endsAt.getTime()).toBe(T + 15 * MIN + 60000);
  expect(ended.levels[0].pausedMs).toBe(60000);
});

test('time used excludes earlier pauses too', async () => {
  const attempt = await started({ pauseUsedMs: 40000, endsAt: new Date(T + 15 * MIN + 40000) });
  const ended = await endAttempt(attempt._id, 'ended_early', T + 300000);
  expect(ended.timeUsedMs).toBe(260000);
});
