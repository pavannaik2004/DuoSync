/**
 * Socket.io on the same HTTP server as Express (PRD §3). The handshake checks the
 * same JWT as REST (NFR-3); each attempt has its own room (NFR-4).
 */
const { Server } = require('socket.io');
const { verifyToken } = require('../services/tokenService');
const { resolveIdentity } = require('../services/identityService');
const { createRuntimeRegistry, roomOf } = require('./runtime');
const attemptEvents = require('../services/attemptEvents');
const flow = require('./flow');
const { HINT_DELAY_MS } = require('../services/scoring');
const Attempt = require('../models/Attempt');
const { registerHandlers } = require('./handlers');

const DEFAULTS = {
  countdownMs: 5000, // LOBBY-3
  tickMs: 1000, // TIME-1
  submitGapMs: 2000, // §7.4
  hintDelayMs: HINT_DELAY_MS, // GAME-10
  timerMs: null, // overrides the theme timer; tests only
  levelSetFor: undefined, // (themeContent) => levels; default is a fresh generated set (D60)
};

function attachSockets(httpServer, { clientOrigins, ...rest } = {}) {
  const options = { ...DEFAULTS, ...rest };
  const io = new Server(httpServer, { cors: { origin: clientOrigins } });
  const runtimes = createRuntimeRegistry(io, options);
  io.runtimes = runtimes;

  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
      socket.data.identity = await resolveIdentity({ kind: payload.kind, id: payload.sub, nickname: payload.nickname });
      next();
    } catch {
      next(new Error('AUTH_REQUIRED'));
    }
  });

  // NFR-4: a player removed from the team leaves the attempt's room at once.
  const onRemoved = ({ attemptIds, userId, name, deleted }) => {
    attemptIds.forEach((attemptId) => {
      const runtime = runtimes.peek(attemptId);
      if (!runtime) return;
      runtime.enqueue(async () => {
        [...(runtime.sockets.get(userId) || [])].forEach((socket) => {
          socket.leave(roomOf(attemptId));
          socket.data.attemptId = null;
          runtime.removeSocket(userId, socket);
          socket.emit('attempt:removed', { attemptId, reason: 'REMOVED_FROM_TEAM' });
        });
        if (deleted) return;
        const attempt = await Attempt.findById(attemptId);
        if (!attempt) return;
        await flow.systemMessage(runtime, `${name || 'A player'} left the team`);
        flow.broadcastLobby(runtime, attempt);
      }).catch(() => {});
    });
  };
  attemptEvents.on('members-removed', onRemoved);
  const close = io.close.bind(io);
  io.close = (...args) => {
    attemptEvents.off('members-removed', onRemoved);
    return close(...args);
  };

  io.on('connection', (socket) => registerHandlers(socket, runtimes));
  return io;
}

module.exports = { attachSockets };
