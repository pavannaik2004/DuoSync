/**
 * Attempt gameplay rules (GAME-4..12). Points come only from scoring.js (SCORE-1).
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { isCorrect } = require('./answers');
const { levelPoints, summarize } = require('./scoring');

const over = () => new AppError(409, 'ATTEMPT_OVER', 'This game is over');

/**
 * Checks one answer for the current level (GAME-4..7). Returns:
 * { kind: 'ignored' } when `order` is not the current level or another submission won;
 * { kind: 'wrong', order, wrongCount, attempt };
 * { kind: 'solved', order, points, finished, attempt }.
 * A solve is one conditional update on `levels.<i>.solvedAt: null`, so a level is
 * solved and scored at most once even if two answers race (NFR-9).
 */
async function submitAnswer(attemptId, player, { order, answer }, now) {
  const attempt = await Attempt.findById(attemptId);
  if (attempt && ['lobby', 'countdown'].includes(attempt.status)) {
    throw new AppError(409, 'NOT_STARTED', 'The game has not started yet');
  }
  if (!attempt || attempt.status !== 'in_progress' || now >= new Date(attempt.endsAt).getTime()) throw over();

  const i = attempt.levels.findIndex((l) => !l.solvedAt);
  if (i === -1 || attempt.levels[i].order !== order) return { kind: 'ignored' };
  const level = attempt.levels[i];
  const unsolved = { _id: attempt._id, status: 'in_progress', [`levels.${i}.solvedAt`]: null };

  if (!isCorrect(level, answer)) {
    const updated = await Attempt.findOneAndUpdate(
      unsolved,
      { $inc: { [`levels.${i}.wrongCount`]: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) return { kind: 'ignored' };
    return { kind: 'wrong', order, wrongCount: updated.levels[i].wrongCount, attempt: updated };
  }

  const activeMs = now - new Date(level.unlockedAt).getTime();
  const points = levelPoints({ activeMs, wrongCount: level.wrongCount, hintUsed: false }); // hints arrive in Phase 3
  const set = {
    [`levels.${i}.solvedAt`]: new Date(now),
    [`levels.${i}.solvedBy`]: player.id,
    [`levels.${i}.activeMs`]: activeMs,
    [`levels.${i}.points`]: points,
  };
  const finished = i === attempt.levels.length - 1;
  if (!finished) set[`levels.${i + 1}.unlockedAt`] = new Date(now);
  const update = { $set: set, $inc: { levelsCleared: 1, totalPoints: points } };
  if (level.reward) update.$push = { board: { order: level.order, title: level.title, reward: level.reward } };

  const updated = await Attempt.findOneAndUpdate(unsolved, update, { returnDocument: 'after' });
  if (!updated) return { kind: 'ignored' };
  return { kind: 'solved', order, points, finished, attempt: updated };
}

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

module.exports = { submitAnswer, endAttempt };
