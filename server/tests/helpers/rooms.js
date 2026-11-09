const { createPlayer, createRoom } = require('./users');
const { startSocketServer, connect, nextEvent, join } = require('./sockets');

/**
 * Starts a server, signs up alice and bob, opens a room, joins both, has alice
 * claim A and bob claim B, readies both and waits for the start snapshots.
 */
async function startedRoom(options = {}) {
  const srv = await startSocketServer({ countdownMs: 50, tickMs: 100, submitGapMs: 0, ...options });
  const alice = await createPlayer(srv.app, 'alice');
  const bob = await createPlayer(srv.app, 'bob');
  const code = await createRoom(srv.app, alice.auth);
  const a = await connect(srv.url, alice.token);
  const b = await connect(srv.url, bob.token);
  const joined = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await join(a, code);
  await join(b, code);
  await joined;
  await a.emitWithAck('lobby:claimRole', { role: 'A' });
  await b.emitWithAck('lobby:claimRole', { role: 'B' });
  const started = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await a.emitWithAck('lobby:ready');
  await b.emitWithAck('lobby:ready');
  const [snapA, snapB] = await started;
  return { srv, a, b, alice, bob, code, attemptId: snapA.id, snapA, snapB };
}

/** emitWithAck that fails after 3 s instead of hanging when nothing answers. */
const ask = (socket, event, payload) => socket.timeout(3000).emitWithAck(event, payload);
const submit = (socket, order, answer) => ask(socket, 'level:submit', { order, answer });

module.exports = { startedRoom, ask, submit };
