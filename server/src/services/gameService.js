/**
 * Attempt gameplay rules (GAME-4..12). Points come only from scoring.js (SCORE-1).
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { isCorrect } = require('./answers');
const { levelPoints, summarize, HINT_DELAY_MS } = require('./scoring');
const { activeMsOf, foldPause, PAUSE_BUDGET_MS } = require('./clock');

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

  const activeMs = activeMsOf(level, attempt, now); // §7.3: paused time excluded (D68)
  const points = levelPoints({ activeMs, wrongCount: level.wrongCount, hintUsed: Boolean(level.hintRevealedAt) });
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
 * Reveals the current level's hint for the whole team (GAME-10). Returns
 * { kind: 'revealed', order, hint, attempt } or { kind: 'ignored' } (not the current level,
 * or already revealed). The update is conditional on the hint being unrevealed and the
 * level unsolved, so two simultaneous reveals cost the 25 points once (NFR-9).
 */
async function revealHint(attemptId, player, { order }, now, { hintDelayMs = HINT_DELAY_MS } = {}) {
  const attempt = await Attempt.findById(attemptId);
  if (attempt && ['lobby', 'countdown'].includes(attempt.status)) {
    throw new AppError(409, 'NOT_STARTED', 'The game has not started yet');
  }
  if (!attempt || attempt.status !== 'in_progress' || now >= new Date(attempt.endsAt).getTime()) throw over();

  const i = attempt.levels.findIndex((l) => !l.solvedAt);
  if (i === -1 || attempt.levels[i].order !== order) return { kind: 'ignored' };
  const level = attempt.levels[i];
  if (level.hintRevealedAt) return { kind: 'ignored' };
  if (!level.hint) throw new AppError(409, 'NO_HINT', 'This level has no hint');
  if (activeMsOf(level, attempt, now) < hintDelayMs) {
    throw new AppError(409, 'HINT_NOT_READY', 'The hint is not ready yet');
  }
  const updated = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress', [`levels.${i}.solvedAt`]: null, [`levels.${i}.hintRevealedAt`]: null },
    { $set: { [`levels.${i}.hintRevealedAt`]: new Date(now) } },
    { returnDocument: 'after' },
  );
  if (!updated) return { kind: 'ignored' };
  return { kind: 'revealed', order, hint: level.hint, attempt: updated };
}

/**
 * Ends the attempt with a final status and saves its results. A no-op (null) when it
 * has already ended, so a timeout racing a quit or a last solve ends it only once.
 */
async function endAttempt(attemptId, status, now, { pauseBudgetMs = PAUSE_BUDGET_MS } = {}) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || Attempt.FINAL.includes(attempt.status) || !attempt.startedAt) return null;
  if (attempt.status === 'paused' && attempt.pausedAt) {
    // A pause still running is folded first, as a resume would (D70).
    const fold = foldPause(attempt, now, pauseBudgetMs);
    attempt.endsAt = fold.endsAt;
    attempt.pauseUsedMs = (attempt.pauseUsedMs || 0) + fold.stoppedMs;
    if (fold.levelIndex !== -1) attempt.levels[fold.levelIndex].pausedMs += fold.stoppedMs;
    attempt.pausedAt = null;
  }
  const endsAt = new Date(attempt.endsAt).getTime();
  const remainingMs = status === 'finished' ? Math.max(0, endsAt - now) : 0;
  const summary = summarize(attempt.levels, { remainingMs });
  attempt.status = status;
  attempt.finishedAt = new Date(now);
  attempt.timeUsedMs = Math.min(now, endsAt) - new Date(attempt.startedAt).getTime() - (attempt.pauseUsedMs || 0); // D70
  attempt.totalPoints = summary.total;
  attempt.levelsCleared = summary.levelsCleared;
  attempt.bonus = summary.bonus;
  attempt.stars = summary.stars;
  await attempt.save();
  return attempt;
}

module.exports = { submitAnswer, revealHint, endAttempt };
