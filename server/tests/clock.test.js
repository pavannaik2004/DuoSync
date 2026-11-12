const {
  activeMsOf, remainingMsOf, budgetLeftMs, foldPause, graceLeftMs, GRACE_MS, PAUSE_BUDGET_MS,
} = require('../src/services/clock');

const at = (ms) => new Date(ms);

test('the PRD constants: 60 s grace and a 3-minute pause budget (§7.6)', () => {
  expect(GRACE_MS).toBe(60000);
  expect(PAUSE_BUDGET_MS).toBe(180000);
});

test('active time excludes a finished pause and the current one', () => {
  const level = { unlockedAt: at(0), pausedMs: 30000 };
  expect(activeMsOf(level, { status: 'in_progress' }, 120000)).toBe(90000);
  expect(activeMsOf(level, { status: 'paused', pausedAt: at(100000) }, 120000)).toBe(70000);
});

test('active time is never negative and treats a missing pausedMs as 0', () => {
  expect(activeMsOf({ unlockedAt: at(5000) }, { status: 'in_progress' }, 1000)).toBe(0);
  expect(activeMsOf({ unlockedAt: at(0) }, { status: 'in_progress' }, 4000)).toBe(4000);
});

test('remaining time is frozen while paused', () => {
  const a = { status: 'paused', pausedAt: at(100000), endsAt: at(900000), startedAt: at(0) };
  expect(remainingMsOf(a, 100000)).toBe(800000);
  expect(remainingMsOf(a, 150000)).toBe(800000);
});

test('remaining time runs while in progress, stops at 0, and is null before the start', () => {
  const a = { status: 'in_progress', pausedAt: null, endsAt: at(900000), startedAt: at(0) };
  expect(remainingMsOf(a, 100000)).toBe(800000);
  expect(remainingMsOf(a, 1000000)).toBe(0);
  expect(remainingMsOf({ status: 'lobby', endsAt: null }, 5)).toBeNull();
});

test('folding a pause is capped at the remaining budget', () => {
  const a = {
    status: 'paused', pausedAt: at(100000), pauseUsedMs: 170000, endsAt: at(900000), levels: [{ solvedAt: null }],
  };
  expect(foldPause(a, 160000, 180000)).toEqual({ stoppedMs: 10000, endsAt: at(910000), levelIndex: 0 });
});

test('folding a short pause adds all of it, on the first unsolved level', () => {
  const a = {
    status: 'paused', pausedAt: at(100000), pauseUsedMs: 0, endsAt: at(900000),
    levels: [{ solvedAt: at(50000) }, { solvedAt: null }],
  };
  expect(foldPause(a, 130000, 180000)).toEqual({ stoppedMs: 30000, endsAt: at(930000), levelIndex: 1 });
});

test('budget left never goes below 0', () => {
  expect(budgetLeftMs({ status: 'paused', pausedAt: at(0), pauseUsedMs: 175000 }, 20000, 180000)).toBe(0);
  expect(budgetLeftMs({ status: 'paused', pausedAt: at(0), pauseUsedMs: 100000 }, 20000, 180000)).toBe(60000);
  expect(budgetLeftMs({ status: 'in_progress', pausedAt: null, pauseUsedMs: 30000 }, 20000, 180000)).toBe(150000);
});

test('grace left counts from awaySince, and is null for a player who is not away', () => {
  expect(graceLeftMs({ awaySince: at(1000) }, 31000, 60000)).toBe(30000);
  expect(graceLeftMs({ awaySince: at(1000) }, 99000, 60000)).toBe(0);
  expect(graceLeftMs({ awaySince: null }, 99000, 60000)).toBeNull();
});
