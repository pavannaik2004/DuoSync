/**
 * Attempt flow driven by the runtime's timers: the lobby countdown, the start, the
 * 1-second tick with timer warnings, and the end. Shared emit helpers live here too.
 */
const Attempt = require('../models/Attempt');
const lobby = require('../services/lobbyService');
const { endAttempt } = require('../services/gameService');
const { postMessage, recentMessages } = require('../services/chatService');
const { toPlayerView, lobbyView, resultView } = require('../services/attemptView');
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

async function sendSnapshot(runtime, attempt, playerId, target) {
  const view = toPlayerView(attempt, playerId, {
    connectedIds: runtime.connectedIds(),
    messages: await recentMessages(attempt._id),
    hintDelayMs: runtime.options.hintDelayMs,
  });
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
  const messages = await recentMessages(attempt._id);
  attempt.players.forEach((p) => {
    runtime.emitToPlayer(p.id, 'attempt:snapshot', toPlayerView(attempt, p.id, { connectedIds: runtime.connectedIds(), messages, hintDelayMs: runtime.options.hintDelayMs }));
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

/** Ends the attempt once and tells both players (GAME-11, GAME-12). Run inside the queue. */
async function finish(runtime, status) {
  const attempt = await endAttempt(runtime.attemptId, status, Date.now());
  stopTicking(runtime);
  runtime.clear(runtime.hintTimer);
  runtime.hintTimer = null;
  if (!attempt) return null;
  await systemMessage(runtime, 'Attempt ended');
  runtime.emitToRoom('attempt:ended', { status: attempt.status, result: resultView(attempt) });
  runtime.release();
  return attempt;
}

/** TIME-1: the server broadcasts the remaining time every tick; clients only display it. */
function startTicking(runtime, endsAt) {
  if (runtime.tickTimer) return;
  const end = new Date(endsAt).getTime();
  const initial = end - Date.now();
  // Thresholds already passed at start (a short timer, or a resume) are not announced.
  runtime.warned = new Set(WARNINGS.filter(([ms]) => initial <= ms).map(([ms]) => ms));
  runtime.tickTimer = runtime.every(() => {
    const remainingMs = Math.max(0, end - Date.now());
    runtime.emitToRoom('attempt:tick', { remainingMs });
    WARNINGS.forEach(([ms, text]) => {
      if (remainingMs <= ms && !runtime.warned.has(ms)) {
        runtime.warned.add(ms);
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
 * GAME-10: tells both players when the current level's hint unlocks (hintDelayMs after the level
 * opened, by wall time, D59). Call after the start, after each unlock and on resume; it replaces
 * any earlier timer. `quiet` skips the announcement when the delay has already passed (a resume).
 */
function scheduleHint(runtime, attempt, { quiet = false } = {}) {
  runtime.clear(runtime.hintTimer);
  runtime.hintTimer = null;
  if (attempt.status !== 'in_progress') return;
  const level = attempt.levels.find((l) => !l.solvedAt);
  if (!level || !level.hint || level.hintRevealedAt || !level.unlockedAt) return;
  const wait = new Date(level.unlockedAt).getTime() + runtime.options.hintDelayMs - Date.now();
  if (wait <= 0 && quiet) return;
  const { order } = level;
  runtime.hintTimer = runtime.later(() => {
    runtime.hintTimer = null;
    runtime.enqueue(async () => {
      const current = await Attempt.findById(runtime.attemptId);
      if (!current || current.status !== 'in_progress') return;
      const now = current.levels.find((l) => !l.solvedAt);
      if (!now || now.order !== order || now.hintRevealedAt) return;
      runtime.emitToRoom('hint:available', { order });
      await systemMessage(runtime, `Hint ready for ${now.title}`);
    }).catch(logFailure(`hint timer of ${runtime.attemptId}`));
  }, Math.max(0, wait));
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
      await snapshotAll(runtime, await Attempt.findById(attempt._id));
      startTicking(runtime, attempt.endsAt);
      scheduleHint(runtime, await Attempt.findById(attempt._id));
    }).catch(logFailure(`start of ${runtime.attemptId}`));
  }, runtime.options.countdownMs);
}

/**
 * A runtime created after a restart rebuilds its timers from the database (D37):
 * an in-progress attempt resumes ticking (or ends if its time ran out meanwhile),
 * and a countdown with no timer goes back to the lobby.
 */
async function resume(runtime, attempt) {
  if (attempt.status === 'in_progress' && !runtime.tickTimer) {
    if (new Date(attempt.endsAt).getTime() <= Date.now()) return finish(runtime, 'timed_out');
    startTicking(runtime, attempt.endsAt);
    scheduleHint(runtime, attempt, { quiet: true });
  }
  if (attempt.status === 'countdown' && !runtime.countdownTimer) return lobby.resetCountdown(attempt._id);
  return null;
}

module.exports = {
  sendSnapshot, systemMessage, broadcastLobby, snapshotAll, startCountdown, cancelCountdown,
  startTicking, stopTicking, finish, resume, scheduleHint, logFailure,
};
