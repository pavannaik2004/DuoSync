/**
 * Attempt flow driven by the runtime's timers: the lobby countdown, the start, the
 * 1-second tick with timer warnings, disconnect pauses with their grace and budget
 * timers (§7.6), and the end. Shared emit helpers live here too.
 */
const Attempt = require('../models/Attempt');
const lobby = require('../services/lobbyService');
const { endAttempt } = require('../services/gameService');
const { postMessage, recentMessages } = require('../services/chatService');
const { toPlayerView, lobbyView, resultView, themeOf } = require('../services/attemptView');
const pauses = require('../services/pauseService');
const { activeMsOf, budgetLeftMs, graceLeftMs } = require('../services/clock');
const { rankOf } = require('../services/leaderboardService');
const { roomOf } = require('./runtime');

const WARNINGS = [
  [300000, '5 minutes left'],
  [60000, '1 minute left'],
  [10000, '10 seconds left'],
]; // TIME-2

/** A .catch handler for queued background jobs: they have no caller to report to, so they log. */
function logFailure(label) {
  return (err) => console.error(`Background job failed (${label}):`, err);
}

const ms = (date) => (date ? new Date(date).getTime() : null);

/** The theme's name for the player's role, or the player's name before roles exist. */
function roleNameOf(attempt, player) {
  const roles = themeOf(attempt).roles || {};
  return player.role && roles[player.role] ? roles[player.role].name : player.name;
}

const whoOf = (player) => ({ id: player.id, name: player.name, role: player.role || null });
const graceSeconds = (runtime) => Math.round(runtime.options.graceMs / 1000);

async function viewOptions(runtime, attempt) {
  const { hintDelayMs, graceMs, pauseBudgetMs } = runtime.options;
  const [messages, rank] = await Promise.all([recentMessages(attempt._id), rankOf(attempt)]);
  return { connectedIds: runtime.connectedIds(), messages, hintDelayMs, graceMs, pauseBudgetMs, rank };
}

/** D73: this attempt's challenge board changed (a start, solve, end, pause or resume). */
function notifyBoard(runtime) {
  if (runtime.challengeId && runtime.io.leaderboards) runtime.io.leaderboards.changed(runtime.challengeId);
}

async function sendSnapshot(runtime, attempt, playerId, target) {
  const view = toPlayerView(attempt, playerId, await viewOptions(runtime, attempt));
  target.emit('attempt:snapshot', view);
}

/** A system message to the room, or to everyone in it except `except` (a socket). */
async function systemMessage(runtime, text, { except } = {}) {
  const msg = await postMessage(runtime.attemptId, { kind: 'system', text });
  if (except) except.to(roomOf(runtime.attemptId)).emit('chat:message', msg);
  else runtime.emitToRoom('chat:message', msg);
  return msg;
}

function broadcastLobby(runtime, attempt) {
  runtime.emitToRoom('lobby:update', lobbyView(attempt, runtime.connectedIds()));
}

/** Snapshot to every connected socket of every player (each gets only their own view). */
async function snapshotAll(runtime, attempt) {
  const options = await viewOptions(runtime, attempt);
  attempt.players.forEach((p) => {
    runtime.emitToPlayer(p.id, 'attempt:snapshot', toPlayerView(attempt, p.id, options));
  });
}

function cancelCountdown(runtime) {
  runtime.clear(runtime.countdownTimer);
  runtime.countdownTimer = null;
}

function stopTicking(runtime) {
  runtime.clear(runtime.tickTimer);
  runtime.tickTimer = null;
}

function clearHint(runtime) {
  runtime.clear(runtime.hintTimer);
  runtime.hintTimer = null;
}

function clearBudget(runtime) {
  runtime.clear(runtime.budgetTimer);
  runtime.budgetTimer = null;
}

function clearGrace(runtime, playerId) {
  runtime.clear(runtime.graceTimers.get(playerId));
  runtime.graceTimers.delete(playerId);
}

/** Copies the clock and the away players from the database into the runtime, for the ticks (D81). */
function syncClock(runtime, attempt) {
  runtime.clock = { endsAt: ms(attempt.endsAt), pausedAt: attempt.status === 'paused' ? ms(attempt.pausedAt) : null };
  runtime.awaySince = new Map(attempt.players.filter((p) => p.awaySince).map((p) => [p.id, ms(p.awaySince)]));
}

/** Ends the attempt once and tells both players (GAME-11, GAME-12). Run inside the queue. */
async function finish(runtime, status) {
  const attempt = await endAttempt(runtime.attemptId, status, Date.now(), { pauseBudgetMs: runtime.options.pauseBudgetMs });
  stopTicking(runtime);
  clearHint(runtime);
  clearBudget(runtime);
  [...runtime.graceTimers.keys()].forEach((id) => clearGrace(runtime, id));
  if (!attempt) return null;
  await systemMessage(runtime, 'Attempt ended');
  runtime.emitToRoom('attempt:ended', { status: attempt.status, result: resultView(attempt, { rank: await rankOf(attempt) }) });
  notifyBoard(runtime);
  runtime.release();
  return attempt;
}

/**
 * TIME-1: the server broadcasts the remaining time every tick; clients only display it.
 * While the clock is stopped the ticks go on with a frozen time and each away player's
 * grace left (D81). Reads `runtime.clock`, so call syncClock first.
 */
function startTicking(runtime) {
  if (runtime.tickTimer || !runtime.clock) return;
  const remaining = () => {
    const { endsAt, pausedAt } = runtime.clock;
    return Math.max(0, endsAt - (pausedAt === null ? Date.now() : pausedAt));
  };
  const initial = remaining();
  // Thresholds already passed at start (a short timer, or a resume) are not announced.
  runtime.warned = new Set(WARNINGS.filter(([limit]) => initial <= limit).map(([limit]) => limit));
  runtime.tickTimer = runtime.every(() => {
    const now = Date.now();
    const remainingMs = remaining();
    const paused = runtime.clock.pausedAt !== null;
    const away = [...runtime.awaySince].map(([id, since]) => ({ id, graceMs: Math.max(0, since + runtime.options.graceMs - now) }));
    runtime.emitToRoom('attempt:tick', { remainingMs, paused, away });
    if (paused) return;
    WARNINGS.forEach(([limit, text]) => {
      if (remainingMs <= limit && !runtime.warned.has(limit)) {
        runtime.warned.add(limit);
        runtime.enqueue(() => systemMessage(runtime, text)).catch(logFailure(`timer warning for ${runtime.attemptId}`));
      }
    });
    if (remainingMs === 0) {
      stopTicking(runtime);
      runtime.enqueue(() => finish(runtime, 'timed_out')).catch(logFailure(`timeout of ${runtime.attemptId}`));
    }
  }, runtime.options.tickMs);
}

/**
 * GAME-10: tells both players when the current level's hint unlocks, hintDelayMs of active time
 * after the level opened (D68). Call after the start, after each unlock and on every resume; it
 * replaces any earlier timer. `quiet` skips the announcement when the delay has already passed.
 */
function scheduleHint(runtime, attempt, { quiet = false } = {}) {
  clearHint(runtime);
  if (attempt.status !== 'in_progress') return;
  const level = attempt.levels.find((l) => !l.solvedAt);
  if (!level || !level.hint || level.hintRevealedAt || !level.unlockedAt) return;
  const wait = runtime.options.hintDelayMs - activeMsOf(level, attempt, Date.now());
  if (wait <= 0 && quiet) return;
  const { order } = level;
  if (runtime.hintAnnounced === order) return; // a resume must not announce the same hint again
  runtime.hintTimer = runtime.later(() => {
    runtime.hintTimer = null;
    runtime.enqueue(async () => {
      const current = await Attempt.findById(runtime.attemptId);
      if (!current || current.status !== 'in_progress') return;
      const now = current.levels.find((l) => !l.solvedAt);
      if (!now || now.order !== order || now.hintRevealedAt || runtime.hintAnnounced === order) return;
      runtime.hintAnnounced = order;
      runtime.emitToRoom('hint:available', { order });
      await systemMessage(runtime, `Hint ready for ${now.title}`);
    }).catch(logFailure(`hint timer of ${runtime.attemptId}`));
  }, Math.max(0, wait));
}

/** After a resume: the clock runs again, so the ticks count down and the hint timer restarts. */
function afterResume(runtime, attempt) {
  notifyBoard(runtime);
  clearBudget(runtime);
  syncClock(runtime, attempt);
  scheduleHint(runtime, attempt);
}

/** §7.6: when an away player's 60 s pass, the attempt ends early (TIME-5). */
function armGrace(runtime, playerId, awaySinceMs) {
  clearGrace(runtime, playerId);
  const wait = Math.max(0, awaySinceMs + runtime.options.graceMs - Date.now());
  const timer = runtime.later(() => {
    runtime.graceTimers.delete(playerId);
    runtime.enqueue(async () => {
      const attempt = await Attempt.findById(runtime.attemptId);
      if (!attempt || Attempt.FINAL.includes(attempt.status)) return;
      const player = attempt.players.find((p) => p.id === playerId);
      const left = player && graceLeftMs(player, Date.now(), runtime.options.graceMs);
      if (left === null || left === undefined) return; // came back meanwhile
      if (left > 0) {
        armGrace(runtime, playerId, ms(player.awaySince));
        return;
      }
      await systemMessage(runtime, `${roleNameOf(attempt, player)} did not return within ${graceSeconds(runtime)} seconds.`);
      await finish(runtime, 'ended_early');
    }).catch(logFailure(`grace timer of ${runtime.attemptId}`));
  }, wait);
  runtime.graceTimers.set(playerId, timer);
}

/** §7.6 abuse guard: when the pause budget runs out, the clock runs again although a player is still away. */
function armBudget(runtime, attempt) {
  clearBudget(runtime);
  if (attempt.status !== 'paused') return;
  const { pauseBudgetMs } = runtime.options;
  runtime.budgetTimer = runtime.later(() => {
    runtime.budgetTimer = null;
    runtime.enqueue(async () => {
      const resumed = await pauses.resumeClock(runtime.attemptId, Date.now(), { budgetMs: pauseBudgetMs });
      if (!resumed) return;
      afterResume(runtime, resumed);
      runtime.emitToRoom('attempt:resumed', {
        who: null, reason: 'PAUSE_BUDGET_USED', remainingMs: Math.max(0, ms(resumed.endsAt) - Date.now()), endsAt: resumed.endsAt.toISOString(),
      });
      await systemMessage(runtime, 'The pause budget is used up. The clock is running again.');
    }).catch(logFailure(`pause budget of ${runtime.attemptId}`));
  }, budgetLeftMs(attempt, Date.now(), pauseBudgetMs));
}

/** TIME-3: a player's last socket is gone mid-game. Run inside the queue. Returns the attempt or null. */
async function playerAway(runtime, player) {
  const result = await pauses.markAway(runtime.attemptId, player.id, Date.now(), { budgetMs: runtime.options.pauseBudgetMs });
  if (!result) return null;
  const { attempt, clockStopped } = result;
  syncClock(runtime, attempt);
  if (clockStopped) {
    clearHint(runtime);
    armBudget(runtime, attempt);
    notifyBoard(runtime);
  }
  const me = attempt.players.find((p) => p.id === player.id);
  armGrace(runtime, player.id, ms(me.awaySince));
  runtime.emitToRoom('attempt:paused', {
    who: whoOf(me), graceMs: graceLeftMs(me, Date.now(), runtime.options.graceMs), clockStopped,
  });
  const running = attempt.status === 'paused' ? '' : ' The pause budget is used up, so the clock keeps running.';
  await systemMessage(runtime, `${roleNameOf(attempt, me)} lost connection. Waiting ${graceSeconds(runtime)} seconds for them to return.${running}`);
  return attempt;
}

/** TIME-4: an away player is back. Run inside the queue, before their snapshot. Returns the attempt or null. */
async function playerBack(runtime, player) {
  const result = await pauses.markBack(runtime.attemptId, player.id, Date.now(), { budgetMs: runtime.options.pauseBudgetMs });
  clearGrace(runtime, player.id);
  if (!result) return null;
  const { attempt, resumed } = result;
  syncClock(runtime, attempt);
  if (Attempt.FINAL.includes(attempt.status)) return attempt;
  if (resumed) afterResume(runtime, attempt);
  if (attempt.status === 'in_progress') {
    runtime.emitToRoom('attempt:resumed', {
      who: whoOf(player), reason: 'RETURNED', remainingMs: Math.max(0, ms(attempt.endsAt) - Date.now()), endsAt: attempt.endsAt.toISOString(),
    });
  }
  await systemMessage(runtime, resumed ? `${roleNameOf(attempt, player)} is back. Play resumed.` : `${roleNameOf(attempt, player)} is back.`);
  return attempt;
}

/** The level set could not be built: back to the lobby, everyone unready, and both players are told why. */
async function failStart(runtime, err) {
  console.error(`Could not start attempt ${runtime.attemptId}:`, err);
  try {
    const attempt = await lobby.resetCountdown(runtime.attemptId);
    await systemMessage(runtime, err && err.code === 'THEME_NOT_FOUND'
      ? 'This theme is no longer available. Pick another theme for a new room.'
      : 'The game could not start. Try again.');
    broadcastLobby(runtime, attempt);
  } catch (resetErr) {
    console.error(`Could not reset attempt ${runtime.attemptId} after a failed start:`, resetErr);
  }
}

/** LOBBY-3: after countdownMs the attempt starts, unless someone cancelled. */
function startCountdown(runtime) {
  cancelCountdown(runtime);
  runtime.countdownTimer = runtime.later(() => {
    runtime.countdownTimer = null;
    runtime.enqueue(async () => {
      let attempt;
      try {
        attempt = await lobby.startAttempt(runtime.attemptId, { now: Date.now(), timerMs: runtime.options.timerMs, levelSetFor: runtime.options.levelSetFor });
      } catch (err) {
        await failStart(runtime, err);
        return;
      }
      if (!attempt) return;
      if (attempt.refused) {
        await systemMessage(runtime, 'The challenge window has closed. This attempt can no longer start.');
        broadcastLobby(runtime, await Attempt.findById(runtime.attemptId));
        return;
      }
      await systemMessage(runtime, 'Attempt started');
      const started = await Attempt.findById(attempt._id);
      await snapshotAll(runtime, started);
      syncClock(runtime, started);
      startTicking(runtime);
      scheduleHint(runtime, started);
      notifyBoard(runtime);
    }).catch(logFailure(`start of ${runtime.attemptId}`));
  }, runtime.options.countdownMs);
}

module.exports = {
  sendSnapshot, systemMessage, broadcastLobby, snapshotAll, startCountdown, cancelCountdown,
  startTicking, stopTicking, finish, scheduleHint, logFailure, syncClock,
  playerAway, playerBack, armGrace, armBudget, roleNameOf, notifyBoard,
};
