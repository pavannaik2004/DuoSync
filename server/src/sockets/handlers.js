/**
 * Socket event handlers: validate the payload, check membership, then run the change
 * inside the attempt's queue and emit the results. Game rules live in services;
 * timers and shared emits live in flow.js.
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { joinPractice } = require('../services/practiceService');
const { postMessage } = require('../services/chatService');
const lobby = require('../services/lobbyService');
const flow = require('./flow');
const { str, oneOf } = require('./validate');
const { roomOf } = require('./runtime');

const CHAT_MAX = 300; // CHAT-1

function errorBody(err) {
  if (err instanceof AppError) return { error: err.code, message: err.message };
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return { error: 'INTERNAL_ERROR', message: 'Something went wrong' };
}

/**
 * Wraps a handler. Replies through the ack when the client sent one ({ ok: true, ... }
 * or { error, message }); otherwise errors go out as an `error` event (DECISIONS D39).
 * Events are emitted before the ack, so a client's ack resolves after its updates.
 */
function handle(socket, fn) {
  return async (payload, ack) => {
    if (typeof payload === 'function') {
      ack = payload; // emitted with an ack but no payload
      payload = {};
    }
    const reply = typeof ack === 'function' ? ack : null;
    try {
      const extra = await fn(payload && typeof payload === 'object' ? payload : {});
      if (reply) reply({ ok: true, ...(extra || {}) });
    } catch (err) {
      const body = errorBody(err);
      if (reply) reply(body);
      else socket.emit('error', body);
    }
  };
}

/** Loads the socket's attempt and checks that the sender is one of its players (NFR-3). */
async function loadMembership(socket) {
  const { attemptId } = socket.data;
  const attempt = attemptId ? await Attempt.findById(attemptId) : null;
  const player = attempt && attempt.players.find((p) => p.id === socket.data.identity.id);
  if (!player) throw new AppError(403, 'NOT_IN_ATTEMPT', 'Join the game before doing that');
  return { attempt, player };
}

function registerHandlers(socket, runtimes) {
  const { identity } = socket.data;
  const runtimeOf = () => runtimes.get(socket.data.attemptId);

  /** Membership check, then `fn(runtime, player)` inside the attempt's queue. */
  const queued = (fn) => async () => {
    const { player } = await loadMembership(socket);
    const runtime = runtimeOf();
    return runtime.enqueue(() => fn(runtime, player));
  };

  socket.on('attempt:join', handle(socket, async ({ practiceCode }) => {
    const code = str(practiceCode, { field: 'Room code', max: 16 });
    const joined = await joinPractice(code, identity);
    const attemptId = String(joined._id);
    if (socket.data.attemptId && socket.data.attemptId !== attemptId) {
      throw new AppError(409, 'ALREADY_IN_ATTEMPT', 'This connection is already in another game');
    }
    const runtime = runtimes.get(attemptId);
    await runtime.enqueue(async () => {
      socket.data.attemptId = attemptId;
      socket.join(roomOf(attemptId));
      const first = runtime.addSocket(identity.id, socket);
      await flow.resume(runtime, await Attempt.findById(attemptId));
      const attempt = await Attempt.findById(attemptId);
      if (first && !Attempt.FINAL.includes(attempt.status)) {
        await flow.systemMessage(runtime, `${identity.name} joined`, { except: socket });
      }
      await flow.sendSnapshot(runtime, attempt, identity.id, socket);
      if (first) flow.broadcastLobby(runtime, attempt);
    });
  }));

  socket.on('chat:send', handle(socket, async ({ text }) => {
    const clean = str(text, { field: 'Message', max: CHAT_MAX });
    await queued(async (runtime, player) => {
      const msg = await postMessage(runtime.attemptId, { kind: 'user', senderName: player.name, role: player.role || null, text: clean });
      runtime.emitToRoom('chat:message', msg);
    })();
  }));

  socket.on('lobby:claimRole', handle(socket, async ({ role }) => {
    oneOf(role, ['A', 'B'], 'Role');
    await queued(async (runtime) => {
      flow.broadcastLobby(runtime, await lobby.claimRole(runtime.attemptId, identity.id, role));
    })();
  }));

  socket.on('lobby:releaseRole', handle(socket, queued(async (runtime) => {
    flow.broadcastLobby(runtime, await lobby.releaseRole(runtime.attemptId, identity.id));
  })));

  socket.on('lobby:ready', handle(socket, queued(async (runtime) => {
    const attempt = await lobby.setReady(runtime.attemptId, identity.id, {
      connectedIds: runtime.connectedIds(), now: Date.now(), countdownMs: runtime.options.countdownMs,
    });
    flow.broadcastLobby(runtime, attempt);
    if (attempt.status === 'countdown' && !runtime.countdownTimer) flow.startCountdown(runtime);
  })));

  socket.on('lobby:cancel', handle(socket, queued(async (runtime) => {
    const attempt = await lobby.unready(runtime.attemptId, identity.id);
    if (attempt.status === 'lobby') flow.cancelCountdown(runtime);
    flow.broadcastLobby(runtime, attempt);
  })));

  socket.on('disconnect', () => {
    if (!socket.data.attemptId) return;
    const runtime = runtimeOf();
    runtime.enqueue(async () => {
      if (!runtime.removeSocket(identity.id, socket)) return;
      let attempt = await Attempt.findById(runtime.attemptId);
      if (!attempt) return;
      if (attempt.status === 'countdown') {
        // A player who leaves during the countdown cancels it (LOBBY-3).
        attempt = await lobby.unready(runtime.attemptId, identity.id);
        flow.cancelCountdown(runtime);
      }
      if (!Attempt.FINAL.includes(attempt.status)) {
        await flow.systemMessage(runtime, `${identity.name} left`);
        flow.broadcastLobby(runtime, attempt);
      }
      if (!runtime.hasSockets() && Attempt.FINAL.includes(attempt.status)) runtimes.drop(runtime.attemptId);
    }).catch(errorBody);
  });
}

module.exports = { registerHandlers, handle, loadMembership, errorBody };
