const Attempt = require('../src/models/Attempt');
const cyberHeist = require('../src/content').getContent('cyber-heist');
const { normalizeAnswer } = require('../src/services/answers');
const { toPlayerView, levelBar, lobbyView, resultView } = require('../src/services/attemptView');

const now = new Date('2026-11-09T10:00:00Z').getTime();
const minutes = (n) => n * 60 * 1000;

function inProgress() {
  const levels = cyberHeist.levels.map((l) => ({ ...l }));
  levels[0].unlockedAt = new Date(now - minutes(3));
  levels[0].solvedAt = new Date(now - minutes(2));
  levels[0].solvedBy = 'ann';
  levels[0].points = 100;
  levels[1].unlockedAt = new Date(now - minutes(2));
  return new Attempt({
    practiceCode: 'ABCDEF',
    themeSlug: 'cyber-heist',
    timerMinutes: 15,
    status: 'in_progress',
    players: [
      { id: 'ann', kind: 'user', name: 'ann', role: 'A', ready: true },
      { id: 'ben', kind: 'guest', name: 'ben', role: 'B', ready: true },
    ],
    levels,
    board: [{ order: 1, title: 'Access PIN', reward: 'D' }],
    startedAt: new Date(now - minutes(3)),
    endsAt: new Date(now + minutes(12)),
  });
}

test('player A sees only their own half and no answers', () => {
  const attempt = inProgress();
  const json = JSON.stringify(toPlayerView(attempt, 'ann', { now }));
  for (const banned of ['"answer"', 'acceptedAnswers', 'explanation', 'clueA', 'clueB', 'answerKind']) {
    expect(json).not.toContain(banned);
  }
  for (const l of cyberHeist.levels) expect(json).not.toContain(normalizeAnswer(l.answer, l.answerKind));
  expect(json).not.toContain('Shift every letter back'); // B's half of level 2
  expect(toPlayerView(attempt, 'ann', { now }).clue)
    .toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueA, hint: { ready: true, text: null } });
  expect(toPlayerView(attempt, 'ben', { now }).clue.clue).toEqual(cyberHeist.levels[1].clueB);
});

test('level bar, board, score, me and remaining time after one solve', () => {
  const view = toPlayerView(inProgress(), 'ben', { now, connectedIds: ['ann'] });
  expect(view.levels.map((l) => l.state)).toEqual(['solved', 'current', 'locked', 'locked', 'locked']);
  expect(view.levels[0]).toEqual({ order: 1, title: 'Access PIN', state: 'solved', points: 100, wrongCount: 0 });
  expect(view.board).toEqual([{ order: 1, title: 'Access PIN', reward: 'D' }]);
  expect(view.score).toBe(100);
  expect(view.me).toEqual({ id: 'ben', role: 'B' });
  expect(view.remainingMs).toBe(minutes(12));
  expect(view.players).toEqual([
    { id: 'ann', name: 'ann', role: 'A', ready: true, connected: true },
    { id: 'ben', name: 'ben', role: 'B', ready: true, connected: false },
  ]);
  expect(view.theme).toEqual({
    slug: 'cyber-heist',
    name: cyberHeist.theme.name,
    story: cyberHeist.theme.story,
    timerMinutes: 15,
    roles: cyberHeist.theme.roles,
  });
  expect(view.result).toBeNull();
});

test('before the start: no levels, no clue, remainingMs null', () => {
  const attempt = new Attempt({
    practiceCode: 'ABCDEF', themeSlug: 'cyber-heist', timerMinutes: 15, status: 'lobby',
    players: [{ id: 'ann', kind: 'user', name: 'ann', role: 'A', ready: false }],
  });
  const view = toPlayerView(attempt, 'ann', { now });
  expect(view).toMatchObject({ status: 'lobby', levels: [], clue: null, remainingMs: null, score: 0, board: [] });
  expect(levelBar(attempt)).toEqual([]);
  expect(lobbyView(attempt, ['ann'])).toEqual({
    status: 'lobby',
    countdownEndsAt: null,
    players: [{ id: 'ann', name: 'ann', role: 'A', ready: false, connected: true }],
  });
});

test('a player who has not claimed a role gets clue null', () => {
  const attempt = inProgress();
  attempt.players[1].role = null;
  expect(toPlayerView(attempt, 'ben', { now }).clue).toBeNull();
});

test('practice code is stored uppercase', () => {
  expect(new Attempt({ practiceCode: ' abcdef ', themeSlug: 'cyber-heist' }).practiceCode).toBe('ABCDEF');
});

test('resultView is null until final, then carries the summary and revealText or failText', () => {
  const attempt = inProgress();
  expect(resultView(attempt)).toBeNull();

  attempt.status = 'ended_early';
  attempt.timeUsedMs = minutes(3);
  const early = resultView(attempt);
  expect(early).toMatchObject({
    status: 'ended_early', levelPoints: 100, bonus: 0, total: 100, stars: 0, levelsCleared: 1,
    wrongAnswers: 0, timeUsedMs: minutes(3), text: cyberHeist.theme.failText,
  });
  expect(early.levels[0]).toEqual({ order: 1, title: 'Access PIN', solved: true, points: 100, wrongCount: 0 });
  expect(early.levels[1].solved).toBe(false);

  attempt.levels.forEach((l) => { l.solvedAt = new Date(now); l.points = 100; });
  attempt.status = 'finished';
  attempt.bonus = 20;
  const done = resultView(attempt);
  expect(done).toMatchObject({ levelPoints: 500, bonus: 20, total: 520, stars: 3, text: cyberHeist.theme.revealText });
  expect(JSON.stringify(done)).not.toContain('NODE');
});

test('themeOf falls back to the content module for a Phase 2 attempt without a snapshot (D51)', () => {
  const { themeOf } = require('../src/services/attemptView');
  const old = inProgress(); // themeSlug only, no theme snapshot
  expect(old.theme).toBeNull();
  expect(themeOf(old)).toBe(cyberHeist.theme);
  const view = toPlayerView(old, 'ann', { now });
  expect(view.theme).toMatchObject({ slug: 'cyber-heist', name: cyberHeist.theme.name, roles: cyberHeist.theme.roles });
});

test('an unrevealed hint never appears in any payload', () => {
  const attempt = inProgress();
  const hint = attempt.levels[1].hint;
  expect(hint).toBeTruthy();
  const late = now + minutes(5); // ready, but not revealed
  const view = toPlayerView(attempt, 'ann', { now: late });
  expect(view.clue.hint).toEqual({ ready: true, text: null });
  expect(JSON.stringify(view)).not.toContain(hint);
  attempt.levels[1].hintRevealedAt = new Date(now);
  const after = toPlayerView(attempt, 'ben', { now: late });
  expect(after.clue.hint).toEqual({ ready: true, text: hint });
});

test('the hint is not ready before the delay, nor for a level without a hint', () => {
  const attempt = inProgress();
  attempt.levels[1].unlockedAt = new Date(now - 89000);
  expect(toPlayerView(attempt, 'ann', { now }).clue.hint.ready).toBe(false); // delay is 90 s
  expect(toPlayerView(attempt, 'ann', { now: now + 1000 }).clue.hint.ready).toBe(true);
  attempt.levels[1].hint = null;
  expect(toPlayerView(attempt, 'ann', { now: now + minutes(5) }).clue.hint).toEqual({ ready: false, text: null });
});
