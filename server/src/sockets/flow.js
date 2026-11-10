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

async function sendSnapshot(runtime, attempt, playerId, target) {
  const view = toPlayerView(attempt, playerId, {
    connectedIds: runtime.connectedIds(),
    messages: await recentMessages(attempt._id),
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
    runtime.emitToPlayer(p.id, 'attempt:snapshot', toPlayerView(attempt, p.id, { connectedIds: runtime.connectedIds(), messages }));
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
        runtime.enqueue(() => systemMessage(runtime, text)).catch(() => {});
      }
    });
    if (remainingMs === 0) {
      stopTicking(runtime);
      runtime.enqueue(() => finish(runtime, 'timed_out')).catch(() => {});
    }
  }, runtime.options.tickMs);
}

/** LOBBY-3: after countdownMs the attempt starts, unless someone cancelled. */
function startCountdown(runtime) {
  cancelCountdown(runtime);
  runtime.countdownTimer = runtime.later(() => {
    runtime.countdownTimer = null;
    runtime.enqueue(async () => {
      const attempt = await lobby.startAttempt(runtime.attemptId, { now: Date.now(), timerMs: runtime.options.timerMs, levelSetFor: runtime.options.levelSetFor });
      if (!attempt) return;
      await systemMessage(runtime, 'Attempt started');
      await snapshotAll(runtime, await Attempt.findById(attempt._id));
      startTicking(runtime, attempt.endsAt);
    }).catch(() => {});
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
  }
  if (attempt.status === 'countdown' && !runtime.countdownTimer) return lobby.resetCountdown(attempt._id);
  return null;
}

module.exports = {
  sendSnapshot, systemMessage, broadcastLobby, snapshotAll, startCountdown, cancelCountdown,
  startTicking, stopTicking, finish, resume,
};
