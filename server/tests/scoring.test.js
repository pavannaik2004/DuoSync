const { levelPoints, completionBonus, starsFor, summarize } = require('../src/services/scoring');

test('§7.3 worked example: 180 s, 1 wrong, no hint → 70', () => {
  expect(levelPoints({ activeMs: 180000, wrongCount: 1, hintUsed: false })).toBe(70);
});

test('first 60 s are free; 65.9 s is still 100', () => {
  expect(levelPoints({ activeMs: 65900, wrongCount: 0, hintUsed: false })).toBe(100);
});

test('66 s → 99', () => {
  expect(levelPoints({ activeMs: 66000, wrongCount: 0, hintUsed: false })).toBe(99);
});

test('the hint costs 25', () => {
  expect(levelPoints({ activeMs: 0, wrongCount: 0, hintUsed: true })).toBe(75);
});

test('a solved level is worth at least 30', () => {
  expect(levelPoints({ activeMs: 3600000, wrongCount: 9, hintUsed: true })).toBe(30);
});

test('bonus: 1 point per full 5 s left, never negative', () => {
  expect(completionBonus(12999)).toBe(2);
  expect(completionBonus(-5)).toBe(0);
});

test.each([[4, 999, 0], [5, 349, 1], [5, 350, 2], [5, 449, 2], [5, 450, 3]])(
  'stars(%p cleared, %p points) → %p',
  (levelsCleared, total, stars) => expect(starsFor({ total, levelsCleared })).toBe(stars),
);

test('summarize adds the bonus only when all 5 are solved', () => {
  const solved = (points, wrongCount = 0) => ({ points, wrongCount, solvedAt: new Date() });
  const four = [solved(100), solved(70, 1), solved(90), solved(80), { points: 0, wrongCount: 2, solvedAt: null }];
  expect(summarize(four, { remainingMs: 60000 })).toEqual({
    levelPoints: 340, levelsCleared: 4, wrongAnswers: 3, bonus: 0, total: 340, stars: 0,
  });
  const five = [...four.slice(0, 4), solved(100)];
  expect(summarize(five, { remainingMs: 60000 })).toEqual({
    levelPoints: 440, levelsCleared: 5, wrongAnswers: 1, bonus: 12, total: 452, stars: 3,
  });
});
