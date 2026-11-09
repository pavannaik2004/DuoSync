/**
 * Socket event handlers: validate the payload, check membership, then run the change
 * inside the attempt's queue and emit the results. Game rules live in services.
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { joinPractice } = require('../services/practiceService');
const { postMessage, recentMessages } = require('../services/chatService');
const { toPlayerView, lobbyView } = require('../services/attemptView');
const { str } = require('./validate');
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

async function sendSnapshot(runtime, attempt, playerId, target) {
  const view = toPlayerView(attempt, playerId, {
    connectedIds: runtime.connectedIds(),
    messages: await recentMessages(attempt._id),
  });
  target.emit('attempt:snapshot', view);
}

async function systemMessage(runtime, text, { except } = {}) {
  const msg = await postMessage(runtime.attemptId, { kind: 'system', text });
  if (except) except.to(roomOf(runtime.attemptId)).emit('chat:message', msg);
  else runtime.emitToRoom('chat:message', msg);
  return msg;
}

function registerHandlers(socket, runtimes) {
  const { identity } = socket.data;
  const runtimeOf = () => runtimes.get(socket.data.attemptId);

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
      const attempt = await Attempt.findById(attemptId);
      if (first) await systemMessage(runtime, `${identity.name} joined`, { except: socket });
      await sendSnapshot(runtime, attempt, identity.id, socket);
      if (first) runtime.emitToRoom('lobby:update', lobbyView(attempt, runtime.connectedIds()));
    });
  }));

  socket.on('chat:send', handle(socket, async ({ text }) => {
    const clean = str(text, { field: 'Message', max: CHAT_MAX });
    const { attempt, player } = await loadMembership(socket);
    const runtime = runtimeOf();
    await runtime.enqueue(async () => {
      const msg = await postMessage(attempt._id, { kind: 'user', senderName: player.name, role: player.role || null, text: clean });
      runtime.emitToRoom('chat:message', msg);
    });
  }));

  socket.on('disconnect', () => {
    if (!socket.data.attemptId) return;
    const runtime = runtimeOf();
    runtime.enqueue(async () => {
      if (!runtime.removeSocket(identity.id, socket)) return;
      const attempt = await Attempt.findById(runtime.attemptId);
      if (!attempt) return;
      if (!Attempt.FINAL.includes(attempt.status)) {
        await systemMessage(runtime, `${identity.name} left`);
        runtime.emitToRoom('lobby:update', lobbyView(attempt, runtime.connectedIds()));
      }
      if (!runtime.hasSockets() && Attempt.FINAL.includes(attempt.status)) runtimes.drop(runtime.attemptId);
    }).catch((err) => errorBody(err));
  });
}

module.exports = { registerHandlers, handle, loadMembership, sendSnapshot, systemMessage, errorBody };
