/**
 * Disconnect pauses (PRD §7.6, TIME-3..5; DECISIONS D67, D70). Every write is an atomic
 * conditional update, so a pause starts once and is folded once even if events race.
 * Callers run these inside the attempt's queue; they return null when nothing applied.
 */
const Attempt = require('../models/Attempt');
const { budgetLeftMs, foldPause } = require('./clock');

const LIVE = ['in_progress', 'paused'];
const after = { returnDocument: 'after' };

/** Players whose last socket is gone, oldest first as stored. */
function awayPlayers(attempt) {
  return attempt.players
    .filter((p) => p.awaySince)
    .map((p) => ({ id: p.id, name: p.name, role: p.role || null, awaySince: p.awaySince }));
}

/**
 * Ends the current pause: the clock runs again, `endsAt` moves by the stopped time (capped at the
 * budget), and the open level's `pausedMs` grows by it. Away players stay away (their grace goes on).
 */
async function resumeClock(attemptId, now, { budgetMs }) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || attempt.status !== 'paused' || !attempt.pausedAt) return null;
  const fold = foldPause(attempt, now, budgetMs);
  const inc = { pauseUsedMs: fold.stoppedMs };
  if (fold.levelIndex !== -1) inc[`levels.${fold.levelIndex}.pausedMs`] = fold.stoppedMs;
  return Attempt.findOneAndUpdate(
    { _id: attempt._id, status: 'paused', pausedAt: attempt.pausedAt },
    { $set: { status: 'in_progress', pausedAt: null, endsAt: fold.endsAt }, $inc: inc },
    after,
  );
}

/** A player's last socket dropped mid-game. The clock stops if it is running and budget remains. */
async function markAway(attemptId, playerId, now, { budgetMs }) {
  const marked = await Attempt.findOneAndUpdate(
    { _id: attemptId, status: { $in: LIVE }, players: { $elemMatch: { id: playerId, awaySince: null } } },
    { $set: { 'players.$.awaySince': new Date(now) } },
    after,
  );
  if (!marked) return null;
  if (marked.status !== 'in_progress' || budgetLeftMs(marked, now, budgetMs) <= 0) {
    return { attempt: marked, clockStopped: false };
  }
  const stopped = await Attempt.findOneAndUpdate(
    { _id: marked._id, status: 'in_progress' },
    { $set: { status: 'paused', pausedAt: new Date(now) } },
    after,
  );
  if (stopped) return { attempt: stopped, clockStopped: true };
  return { attempt: await Attempt.findById(marked._id), clockStopped: false };
}

/** An away player is back. When nobody else is away, a stopped clock runs again. */
async function markBack(attemptId, playerId, now, { budgetMs }) {
  const cleared = await Attempt.findOneAndUpdate(
    { _id: attemptId, players: { $elemMatch: { id: playerId, awaySince: { $ne: null } } } },
    { $set: { 'players.$.awaySince': null } },
    after,
  );
  if (!cleared) return null;
  if (cleared.status === 'paused' && awayPlayers(cleared).length === 0) {
    const resumed = await resumeClock(cleared._id, now, { budgetMs });
    if (resumed) return { attempt: resumed, resumed: true };
    return { attempt: await Attempt.findById(cleared._id), resumed: false };
  }
  return { attempt: cleared, resumed: false };
}

module.exports = { markAway, markBack, resumeClock, awayPlayers };
