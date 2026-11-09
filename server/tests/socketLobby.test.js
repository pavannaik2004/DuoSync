const Attempt = require('../src/models/Attempt');
const cyberHeist = require('../src/content/cyberHeist');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createRoom } = require('./helpers/users');
const { startSocketServer, connect, nextEvent, collect, join, wait } = require('./helpers/sockets');

let srv;

beforeAll(startDb);
afterAll(stopDb);
afterEach(async () => {
  if (srv) await srv.close();
  srv = null;
  await clearDb();
});

/** A room with alice (a) and bob (b) joined and in the lobby. */
async function setupRoom(options = {}) {
  srv = await startSocketServer({ countdownMs: 200, tickMs: 100, ...options });
  const alice = await createPlayer(srv.app, 'alice');
  const bob = await createPlayer(srv.app, 'bob');
  const code = await createRoom(srv.app, alice.auth);
  const a = await connect(srv.url, alice.token);
  const b = await connect(srv.url, bob.token);
  const snaps = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await join(a, code);
  await join(b, code);
  await snaps;
  return { a, b, alice, bob, code, attempt: () => Attempt.findOne({ practiceCode: code }) };
}

const claim = (socket, role) => socket.emitWithAck('lobby:claimRole', { role });
const ready = (socket) => socket.emitWithAck('lobby:ready');

/** Both claim roles and ready up; resolves with both start snapshots. */
async function startGame(a, b) {
  await claim(a, 'A');
  await claim(b, 'B');
  const snaps = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await ready(a);
  await ready(b);
  return snaps;
}

test('claiming a role locks it for the partner (ROLE_TAKEN); claiming the other role swaps', async () => {
  const { a, b, attempt } = await setupRoom();
  const update = nextEvent(b, 'lobby:update');
  expect(await claim(a, 'A')).toEqual({ ok: true });
  expect((await update).players.find((p) => p.name === 'alice').role).toBe('A');
  expect(await claim(b, 'A')).toMatchObject({ error: 'ROLE_TAKEN' });

  expect(await claim(a, 'B')).toEqual({ ok: true });
  expect(await claim(b, 'A')).toEqual({ ok: true });
  expect((await attempt()).players.map((p) => p.role)).toEqual(['B', 'A']);
});

test('invalid role → VALIDATION_ERROR; release frees the role', async () => {
  const { a, b } = await setupRoom();
  expect(await claim(a, 'C')).toMatchObject({ error: 'VALIDATION_ERROR' });
  await claim(a, 'A');
  expect(await a.emitWithAck('lobby:releaseRole')).toEqual({ ok: true });
  expect(await claim(b, 'A')).toEqual({ ok: true });
});

test('ready without a role → ROLE_REQUIRED', async () => {
  const { a } = await setupRoom();
  expect(await ready(a)).toMatchObject({ error: 'ROLE_REQUIRED' });
});

test('both ready → countdown → snapshot with level 1 and each player\'s own half', async () => {
  const { a, b, attempt } = await setupRoom();
  await claim(a, 'A');
  await claim(b, 'B');
  await ready(a);
  const countdown = nextEvent(a, 'lobby:update');
  const snaps = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await ready(b);
  const update = await countdown;
  expect(update.status).toBe('countdown');
  expect(Date.parse(update.countdownEndsAt)).toBeGreaterThan(Date.now() - 50);

  const [snapA, snapB] = await snaps;
  expect(snapA.status).toBe('in_progress');
  expect(snapA.clue).toEqual({ order: 1, title: 'Access PIN', clue: cyberHeist.levels[0].clueA });
  expect(snapB.clue.clue).toEqual(cyberHeist.levels[0].clueB);
  expect(snapA.remainingMs).toBeGreaterThan(14 * 60 * 1000);
  expect(snapA.levels.map((l) => l.state)).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);

  const saved = await attempt();
  expect(saved.levels).toHaveLength(5);
  expect(saved.levels[0].unlockedAt).toBeInstanceOf(Date);
  expect(saved.endsAt.getTime() - saved.startedAt.getTime()).toBe(15 * 60 * 1000);
});

test('cancel during the countdown returns to lobby and nothing starts', async () => {
  const { a, b, attempt } = await setupRoom();
  await claim(a, 'A');
  await claim(b, 'B');
  await ready(a);
  await ready(b);
  const update = nextEvent(b, 'lobby:update');
  expect(await a.emitWithAck('lobby:cancel')).toEqual({ ok: true });
  expect(await update).toMatchObject({ status: 'lobby', countdownEndsAt: null });
  expect(await collect(a, 'attempt:snapshot', 400)).toEqual([]);
  const saved = await attempt();
  expect(saved.status).toBe('lobby');
  expect(saved.players.map((p) => p.ready)).toEqual([false, true]);
});

test('ready does not start a countdown while the partner is offline', async () => {
  const { a, b, attempt } = await setupRoom();
  await claim(b, 'B');
  await ready(b);
  const left = nextEvent(a, 'lobby:update');
  b.disconnect();
  await left;
  await claim(a, 'A');
  expect(await ready(a)).toEqual({ ok: true });
  await wait(400);
  expect((await attempt()).status).toBe('lobby');
});

test('the partner disconnecting during the countdown cancels it', async () => {
  const { a, b, attempt } = await setupRoom({ countdownMs: 400 });
  await claim(a, 'A');
  await claim(b, 'B');
  await ready(a);
  await ready(b);
  const update = nextEvent(a, 'lobby:update');
  b.disconnect();
  expect((await update).status).toBe('lobby');
  expect(await collect(a, 'attempt:snapshot', 600)).toEqual([]);
  expect((await attempt()).status).toBe('lobby');
});

test('ticks arrive about every tickMs and remainingMs decreases', async () => {
  const { a, b } = await setupRoom();
  await startGame(a, b);
  const ticks = await collect(a, 'attempt:tick', 450);
  expect(ticks.length).toBeGreaterThanOrEqual(3);
  const remaining = ticks.map((t) => t.remainingMs);
  expect([...remaining].sort((x, y) => y - x)).toEqual(remaining);
  expect(remaining[0]).toBeLessThanOrEqual(15 * 60 * 1000);
});

test('the timer running out ends the attempt as timed_out', async () => {
  const { a, b, attempt } = await setupRoom({ timerMs: 600 });
  const ended = nextEvent(a, 'attempt:ended', 3000);
  await startGame(a, b);
  const end = await ended;
  expect(end.status).toBe('timed_out');
  expect(end.result).toMatchObject({ status: 'timed_out', total: 0, levelsCleared: 0 });
  expect((await attempt()).status).toBe('timed_out');
});

test('timer warnings are posted to chat as the thresholds pass (TIME-2)', async () => {
  const { a, b } = await setupRoom({ timerMs: 10300 });
  const messages = [];
  a.on('chat:message', (m) => messages.push(m.text));
  await startGame(a, b);
  await wait(700);
  expect(messages).toContain('10 seconds left');
  expect(messages).not.toContain('1 minute left');
});

test('role changes after the start are rejected (NOT_IN_LOBBY)', async () => {
  const { a, b } = await setupRoom();
  await startGame(a, b);
  expect(await claim(a, 'B')).toMatchObject({ error: 'NOT_IN_LOBBY' });
  expect(await a.emitWithAck('lobby:releaseRole')).toMatchObject({ error: 'NOT_IN_LOBBY' });
});

test('after a restart, rejoining an in-progress attempt resumes the ticks (D37)', async () => {
  const { a, b, alice, code } = await setupRoom();
  await startGame(a, b);
  srv.io.runtimes.stopAll(); // what a server restart loses
  a.disconnect();
  b.disconnect();
  const again = await connect(srv.url, alice.token);
  const snap = nextEvent(again, 'attempt:snapshot');
  await join(again, code);
  expect((await snap).status).toBe('in_progress');
  expect((await collect(again, 'attempt:tick', 350)).length).toBeGreaterThanOrEqual(2);
});
