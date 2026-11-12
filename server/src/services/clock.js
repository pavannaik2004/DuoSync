/**
 * Attempt clock rules with pauses (PRD §7.2, §7.3, §7.5, §7.6; DECISIONS D67, D68, D70).
 * Pure functions: no database, `now` in ms. pauseService writes what they compute.
 */
const GRACE_MS = 60000; // §7.6: a teammate has 60 seconds to come back
const PAUSE_BUDGET_MS = 180000; // §7.6: at most 3 minutes of stopped clock per attempt

const ms = (date) => new Date(date).getTime();
const isPaused = (attempt) => attempt.status === 'paused' && Boolean(attempt.pausedAt);
/** How long the clock has been stopped in the current pause. */
const currentPauseMs = (attempt, now) => (isPaused(attempt) ? Math.max(0, now - ms(attempt.pausedAt)) : 0);

/** A level's time so far, without paused time (D68): drives §7.3 points and the §7.5 hint delay. */
function activeMsOf(level, attempt, now) {
  const active = now - ms(level.unlockedAt) - (level.pausedMs || 0) - currentPauseMs(attempt, now);
  return Math.max(0, active);
}

/** Time left on the attempt; frozen while paused (§7.6). Null before the start. */
function remainingMsOf(attempt, now) {
  if (!attempt.endsAt) return null;
  const at = isPaused(attempt) ? ms(attempt.pausedAt) : now;
  return Math.max(0, ms(attempt.endsAt) - at);
}

/** Pause budget still unused, counting the pause in progress. */
function budgetLeftMs(attempt, now, budgetMs) {
  return Math.max(0, budgetMs - (attempt.pauseUsedMs || 0) - currentPauseMs(attempt, now));
}

/**
 * What ending the current pause changes: the stopped time (capped at the budget left when the
 * pause began, D70), the new end time and the level that was open (−1 if none).
 */
function foldPause(attempt, now, budgetMs) {
  const allowed = Math.max(0, budgetMs - (attempt.pauseUsedMs || 0));
  const stoppedMs = Math.min(currentPauseMs(attempt, now), allowed);
  return {
    stoppedMs,
    endsAt: new Date(ms(attempt.endsAt) + stoppedMs),
    levelIndex: attempt.levels.findIndex((l) => !l.solvedAt),
  };
}

/** Grace left for an away player (§7.6), or null when the player is not away. */
function graceLeftMs(player, now, graceMs) {
  if (!player.awaySince) return null;
  return Math.max(0, ms(player.awaySince) + graceMs - now);
}

module.exports = {
  GRACE_MS, PAUSE_BUDGET_MS, activeMsOf, remainingMsOf, budgetLeftMs, foldPause, graceLeftMs,
};
