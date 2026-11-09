/**
 * Socket.io on the same HTTP server as Express (PRD §3). The handshake checks the
 * same JWT as REST (NFR-3); each attempt has its own room (NFR-4).
 */
const { Server } = require('socket.io');
const { verifyToken } = require('../services/tokenService');
const { resolveIdentity } = require('../services/identityService');
const { createRuntimeRegistry } = require('./runtime');
const { registerHandlers } = require('./handlers');

const DEFAULTS = {
  countdownMs: 5000, // LOBBY-3
  tickMs: 1000, // TIME-1
  submitGapMs: 2000, // §7.4
  timerMs: null, // overrides the theme timer; tests only
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

  io.on('connection', (socket) => registerHandlers(socket, runtimes));
  return io;
}

module.exports = { attachSockets };
