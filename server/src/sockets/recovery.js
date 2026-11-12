/**
 * Boot-time recovery of live attempts (roadmap; DECISIONS D37, D71, resolves Q5). After a
 * restart no socket is connected and no timer exists, so every live attempt is rebuilt here:
 * a countdown goes back to the lobby; a game whose time or grace ran out ends; any other game
 * waits for its players as if they had all just disconnected.
 */
const Attempt = require('../models/Attempt');
const lobby = require('../services/lobbyService');
const pauses = require('../services/pauseService');
const { graceLeftMs, activeMsOf } = require('../services/clock');
const flow = require('./flow');

const LIVE = ['in_progress', 'paused'];
const ms = (date) => new Date(date).getTime();

/**
 * Rebuilds one runtime from its attempt. Run inside the attempt's queue. Players with a connected
 * socket in this runtime are left alone; the others are marked away from `now`, and players already
 * away keep their original awaySince, so a restart never resets a grace. Returns 'lobby', 'ended',
 * 'resumed' or null.
 */
async function recoverOne(runtime, attempt, now = Date.now()) {
  runtime.resumed = true;
  runtime.challengeId = attempt.challengeId ? String(attempt.challengeId) : null;
  if (attempt.status === 'countdown') {
    if (runtime.countdownTimer) return null;
    await lobby.resetCountdown(attempt._id);
    return 'lobby';
  }
  if (!LIVE.includes(attempt.status) || runtime.tickTimer) return null;

  if (attempt.status === 'in_progress' && ms(attempt.endsAt) <= now) {
    await flow.finish(runtime, 'timed_out');
    return 'ended';
  }
  const { graceMs, pauseBudgetMs } = runtime.options;
  const expired = attempt.players.find((p) => p.awaySince && graceLeftMs(p, now, graceMs) === 0);
  if (expired) {
    await flow.systemMessage(runtime, `${flow.roleNameOf(attempt, expired)} did not return within ${Math.round(graceMs / 1000)} seconds.`);
    await flow.finish(runtime, 'ended_early');
    return 'ended';
  }

  for (const player of attempt.players) {
    if (!player.awaySince && !runtime.sockets.has(player.id)) {
      await pauses.markAway(attempt._id, player.id, now, { budgetMs: pauseBudgetMs });
    }
  }
  const fresh = await Attempt.findById(attempt._id);
  // A hint whose delay passed before the restart was announced then; a later resume must not repeat it.
  const level = fresh.levels.find((l) => !l.solvedAt);
  if (level && level.unlockedAt && activeMsOf(level, fresh, now) >= runtime.options.hintDelayMs) runtime.hintAnnounced = level.order;
  flow.syncClock(runtime, fresh);
  flow.startTicking(runtime);
  fresh.players.filter((p) => p.awaySince).forEach((p) => flow.armGrace(runtime, p.id, ms(p.awaySince)));
  if (fresh.status === 'paused') flow.armBudget(runtime, fresh);
  flow.scheduleHint(runtime, fresh, { quiet: true });
  return 'resumed';
}

/** Rebuilds every live attempt at boot. Returns how many went back to the lobby, resumed or ended. */
async function recoverAttempts(io, now = Date.now()) {
  const counts = { lobby: 0, resumed: 0, ended: 0 };
  const live = await Attempt.find({ status: { $in: ['countdown', ...LIVE] } }, { _id: 1 });
  for (const { _id } of live) {
    const runtime = io.runtimes.get(_id);
    try {
      const outcome = await runtime.enqueue(async () => {
        const attempt = await Attempt.findById(_id);
        return attempt ? recoverOne(runtime, attempt, now) : null;
      });
      if (outcome) counts[outcome] += 1;
    } catch (err) {
      console.error(`Could not recover attempt ${_id}:`, err);
    }
    if (!runtime.hasSockets() && !runtime.tickTimer && runtime.timers.size === 0) io.runtimes.drop(_id);
  }
  return counts;
}

module.exports = { recoverAttempts, recoverOne };
