/**
 * Attempt gameplay rules (GAME-4..12). Points come only from scoring.js (SCORE-1).
 */
const Attempt = require('../models/Attempt');
const { summarize } = require('./scoring');

/**
 * Ends the attempt with a final status and saves its results. A no-op (null) when it
 * has already ended, so a timeout racing a quit or a last solve ends it only once.
 */
async function endAttempt(attemptId, status, now) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || Attempt.FINAL.includes(attempt.status) || !attempt.startedAt) return null;
  const endsAt = new Date(attempt.endsAt).getTime();
  const remainingMs = status === 'finished' ? Math.max(0, endsAt - now) : 0;
  const summary = summarize(attempt.levels, { remainingMs });
  attempt.status = status;
  attempt.finishedAt = new Date(now);
  attempt.timeUsedMs = Math.min(now, endsAt) - new Date(attempt.startedAt).getTime();
  attempt.totalPoints = summary.total;
  attempt.levelsCleared = summary.levelsCleared;
  attempt.bonus = summary.bonus;
  attempt.stars = summary.stars;
  await attempt.save();
  return attempt;
}

module.exports = { endAttempt };
