/**
 * PRD §11 acceptance checks that no earlier test pinned exactly. The map from every check
 * to its proof is docs/acceptance.md.
 */
const Attempt = require('../src/models/Attempt');
const Challenge = require('../src/models/Challenge');
const { getContent, listThemes } = require('../src/content');
const { generateLevelSet } = require('../src/generators/levelSet');
const { levelPoints, summarize } = require('../src/services/scoring');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { nextEvent } = require('./helpers/sockets');
const { startedChallengeAttempt } = require('./helpers/rooms');

/** A level "differs" when its clue halves or its answer differ. */
const valuesOf = (l) => JSON.stringify([l.clueA, l.clueB, l.answer]);

describe('a new challenge of the same theme differs in at least 4 of the 5 levels', () => {
  // Ruling (Phase 6): Detective's clock, shoe-size and cipher levels have small value spaces by design,
  // so about 0.4% of its pairs differ in only 3 levels. The check is a rate: at least 99% of pairs
  // differ in 4 or more, and no pair in fewer than 3. See docs/acceptance.md.
  const PAIRS = 300;
  test.each(listThemes())('%s: 300 pairs of seeds', (slug) => {
    const content = getContent(slug);
    const counts = [];
    for (let i = 0; i < PAIRS; i += 1) {
      const a = generateLevelSet(content, `first-${i}`, { quiet: true }).levels;
      const b = generateLevelSet(content, `second-${i}`, { quiet: true }).levels;
      counts.push(a.filter((l, n) => valuesOf(l) !== valuesOf(b[n])).length);
    }
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
    expect(counts.filter((d) => d >= 4).length / PAIRS).toBeGreaterThanOrEqual(0.99);
  });
});

describe('points for 3 scripted runs match §7.3 exactly', () => {
  const MIN = 60000;
  /** A run: per level [activeMs, wrongCount, hintUsed] or null when unsolved, and the time left. */
  function score(run, remainingMs) {
    const levels = run.map((l) => (l
      ? { points: levelPoints({ activeMs: l[0], wrongCount: l[1], hintUsed: l[2] }), wrongCount: l[1], solvedAt: new Date() }
      : { points: 0, wrongCount: 0, solvedAt: null }));
    return { points: levels.map((l) => l.points), ...summarize(levels, { remainingMs }) };
  }

  test('run 1: all five solved, with the completion bonus', () => {
    // 100 (45 s) · 70 (180 s, 1 wrong) · 75 (60 s, hint) · 90 (2 min) · 80 (3 min → 80) ; 4 min 2 s left → 48 bonus
    const got = score([[45000, 0, false], [180000, 1, false], [60000, 0, true], [2 * MIN, 0, false], [3 * MIN, 0, false]], 4 * MIN + 2000);
    expect(got.points).toEqual([100, 70, 75, 90, 80]);
    expect(got).toMatchObject({ levelPoints: 415, bonus: 48, total: 463, levelsCleared: 5, wrongAnswers: 1, stars: 3 });
  });

  test('run 2: the 30-point floor on a slow, wrong-heavy, hinted level', () => {
    // 20 min, 4 wrong, hint → 100 − 190 − 40 − 25 < 30 → 30
    const got = score([[30000, 0, false], [20 * MIN, 4, true], [90000, 2, false], null, null], 0);
    expect(got.points).toEqual([100, 30, 75, 0, 0]);
    expect(got).toMatchObject({ levelPoints: 205, bonus: 0, total: 205, levelsCleared: 3, wrongAnswers: 6, stars: 0 });
  });

  test('run 3: five solved with no time left → no bonus; 2 stars at 350', () => {
    // 70 · 70 · 70 · 70 · 70 → 350, timer at 0 → bonus 0
    const got = score([[180000, 1, false], [180000, 1, false], [180000, 1, false], [180000, 1, false], [180000, 1, false]], 0);
    expect(got).toMatchObject({ levelPoints: 350, bonus: 0, total: 350, levelsCleared: 5, stars: 2 });
  });
});

describe('CHAL-7 with a live server', () => {
  beforeAll(startDb);
  beforeEach(seedThemes);
  afterAll(stopDb);

  let room;
  afterEach(async () => {
    await room.srv.close();
    await clearDb();
  });

  test('an attempt started just before the window closes keeps ticking after it and ends by its own timer', async () => {
    // A 6 s window leaves room for the sign-ups and the lobby on a slow machine; the game then outlives it.
    room = await startedChallengeAttempt({ endsInMs: 6000, timerMs: 10000 });
    const { endsAt } = await Challenge.findById(room.challenge.id);
    expect((await Attempt.findById(room.attemptId)).status).toBe('in_progress');
    await new Promise((r) => setTimeout(r, Math.max(0, endsAt.getTime() - Date.now()) + 300)); // the window has closed
    expect((await Attempt.findById(room.attemptId)).status).toBe('in_progress');
    const tick = await nextEvent(room.a, 'attempt:tick');
    expect(tick.remainingMs).toBeGreaterThan(0);
    const ended = await nextEvent(room.a, 'attempt:ended', 10000);
    expect(ended.status).toBe('timed_out');
  }, 30000);
});
