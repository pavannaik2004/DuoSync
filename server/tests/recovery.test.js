const Attempt = require('../src/models/Attempt');
const { recoverAttempts } = require('../src/sockets/recovery');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { startedAttemptDoc } = require('./helpers/attempts');
const {
  startSocketServer, connect, nextEvent, join, wait,
} = require('./helpers/sockets');
const { startedRoom } = require('./helpers/rooms');

const servers = [];
beforeAll(startDb);
beforeEach(seedThemes);
afterAll(stopDb);
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
  await clearDb();
});

const server = async (options = {}) => {
  const srv = await startSocketServer({ tickMs: 100, ...options });
  servers.push(srv);
  return srv;
};
const MIN = 60000;

test('Q5: a countdown goes back to the lobby with everyone unready', async () => {
  const { _id: id } = await startedAttemptDoc({
    status: 'countdown', countdownEndsAt: new Date(), startedAt: null, endsAt: null, levels: [],
    players: [{ id: 'p1', kind: 'user', name: 'alice', role: 'A', ready: true }, { id: 'p2', kind: 'user', name: 'bob', role: 'B', ready: true }],
  });
  const srv = await server();
  expect(await recoverAttempts(srv.io)).toEqual({ lobby: 1, resumed: 0, ended: 0 });
  const saved = await Attempt.findById(id);
  expect(saved.status).toBe('lobby');
  expect(saved.players.map((p) => p.ready)).toEqual([false, false]);
  expect(srv.io.runtimes.size()).toBe(0);
});

test('an in_progress attempt whose time ran out ends timed_out at boot', async () => {
  const now = Date.now();
  const { _id: id } = await startedAttemptDoc({ startedAt: new Date(now - 20 * MIN), endsAt: new Date(now - 5 * MIN) });
  const srv = await server();
  expect(await recoverAttempts(srv.io)).toEqual({ lobby: 0, resumed: 0, ended: 1 });
  expect((await Attempt.findById(id)).status).toBe('timed_out');
});

test('an in_progress attempt is paused at boot and resumes when both players rejoin', async () => {
  const room = await startedRoom({ graceMs: 5000 });
  servers.push(room.srv);
  await room.srv.close();
  servers.pop();
  await wait(200);
  // The old server's disconnects may have marked players away; a crash would not have.
  await Attempt.updateOne({ _id: room.attemptId }, { $set: { status: 'in_progress', pausedAt: null, 'players.$[].awaySince': null } });

  const srv = await server({ graceMs: 5000, countdownMs: 50, submitGapMs: 0 });
  expect(await recoverAttempts(srv.io)).toEqual({ lobby: 0, resumed: 1, ended: 0 });
  const paused = await Attempt.findById(room.attemptId);
  expect(paused.status).toBe('paused');
  expect(paused.players.every((p) => p.awaySince)).toBe(true);

  const a = await connect(srv.url, room.alice.token);
  const b = await connect(srv.url, room.bob.token);
  await join(a, room.code);
  const resumed = nextEvent(a, 'attempt:resumed');
  const snapB = nextEvent(b, 'attempt:snapshot');
  await join(b, room.code);
  expect(await resumed).toMatchObject({ reason: 'RETURNED' });
  expect((await snapB).clue).toEqual(room.snapB.clue);
  expect((await Attempt.findById(room.attemptId)).status).toBe('in_progress');
  const tick = await nextEvent(a, 'attempt:tick');
  expect(tick.paused).toBe(false);
});

test('Review Focus 5: a grace that started before the restart is not reset', async () => {
  const now = Date.now();
  const { _id: id } = await startedAttemptDoc({
    status: 'paused', pausedAt: new Date(now - 59500), startedAt: new Date(now - 5 * MIN), endsAt: new Date(now + 10 * MIN),
    players: [{ id: 'p1', kind: 'user', name: 'alice', role: 'A' }, { id: 'p2', kind: 'user', name: 'bob', role: 'B', awaySince: new Date(now - 59500) }],
  });
  const srv = await server({ graceMs: 60000 });
  expect(await recoverAttempts(srv.io, now)).toEqual({ lobby: 0, resumed: 1, ended: 0 });
  await wait(1200);
  expect((await Attempt.findById(id)).status).toBe('ended_early');
});

test('a grace that already passed ends the attempt at boot, keeping its points', async () => {
  const now = Date.now();
  const doc = await startedAttemptDoc({
    status: 'paused', pausedAt: new Date(now - 2 * MIN), startedAt: new Date(now - 5 * MIN), endsAt: new Date(now + 10 * MIN),
    players: [{ id: 'p1', kind: 'user', name: 'alice', role: 'A' }, { id: 'p2', kind: 'user', name: 'bob', role: 'B', awaySince: new Date(now - 2 * MIN) }],
  });
  await Attempt.updateOne({ _id: doc._id }, {
    $set: { 'levels.0.solvedAt': new Date(now - 3 * MIN), 'levels.0.points': 100, 'levels.1.unlockedAt': new Date(now - 3 * MIN), levelsCleared: 1, totalPoints: 100 },
  });
  const srv = await server({ graceMs: 60000 });
  expect(await recoverAttempts(srv.io, now)).toEqual({ lobby: 0, resumed: 0, ended: 1 });
  const saved = await Attempt.findById(doc._id);
  expect(saved.status).toBe('ended_early');
  expect(saved.totalPoints).toBe(100);
});
