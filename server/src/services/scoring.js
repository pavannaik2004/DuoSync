/**
 * Scoring rules (PRD §7.3 and §7.8). Pure functions: the server is the only
 * place points are calculated (SCORE-1, NFR-7).
 */
const MAX_POINTS = 100;
const MIN_POINTS = 30;
const FREE_SECONDS = 60;
const SECONDS_PER_POINT = 6;
const WRONG_COST = 10;
const HINT_COST = 25;
const BONUS_MS_PER_POINT = 5000;
const LEVEL_COUNT = 5;

/** max(30, 100 − ⌊(t − 60)⁺ / 6⌋ − 10w − 25h), with t in whole seconds of active time. */
function levelPoints({ activeMs, wrongCount, hintUsed }) {
  const seconds = Math.floor(activeMs / 1000);
  const timeCost = Math.floor(Math.max(0, seconds - FREE_SECONDS) / SECONDS_PER_POINT);
  const points = MAX_POINTS - timeCost - WRONG_COST * wrongCount - (hintUsed ? HINT_COST : 0);
  return Math.max(MIN_POINTS, points);
}

/** 1 point for every full 5 seconds left on the timer. */
function completionBonus(remainingMs) {
  return Math.max(0, Math.floor(remainingMs / BONUS_MS_PER_POINT));
}

/** ★ all 5 cleared, ★★ and ≥ 350 points, ★★★ and ≥ 450 points. */
function starsFor({ total, levelsCleared }) {
  if (levelsCleared < LEVEL_COUNT) return 0;
  if (total >= 450) return 3;
  if (total >= 350) return 2;
  return 1;
}

/** The results breakdown for an attempt's levels. The bonus only counts when all 5 are solved. */
function summarize(levels, { remainingMs }) {
  const solved = levels.filter((l) => l.solvedAt);
  const levelsCleared = solved.length;
  const levelTotal = solved.reduce((sum, l) => sum + l.points, 0);
  const wrongAnswers = levels.reduce((sum, l) => sum + (l.wrongCount || 0), 0);
  const bonus = levelsCleared === LEVEL_COUNT ? completionBonus(remainingMs) : 0;
  const total = levelTotal + bonus;
  return { levelPoints: levelTotal, levelsCleared, wrongAnswers, bonus, total, stars: starsFor({ total, levelsCleared }) };
}

module.exports = { levelPoints, completionBonus, starsFor, summarize, WRONG_COST };
