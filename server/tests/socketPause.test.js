const Attempt = require('../src/models/Attempt');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const {
  connect, nextEvent, collect, join, wait,
} = require('./helpers/sockets');
const { startedRoom, submit, ask } = require('./helpers/rooms');

const ANSWERS = ['9742', 'FIREWALL', '23-12-4', '8315', 'NODE'];
let room;

beforeAll(startDb);
beforeEach(seedThemes);
afterAll(stopDb);
afterEach(async () => {
  if (room) await room.srv.close();
  room = null;
  await clearDb();
});

const pauseRoom = (options = {}) => startedRoom({ graceMs: 400, pauseBudgetMs: 2000, ...options });

/** Bob comes back on a fresh socket; resolves with { socket, snap }. */
async function bobReturns() {
  const socket = await connect(room.srv.url, room.bob.token);
  const snapshot = nextEvent(socket, 'attempt:snapshot');
  await join(socket, room.code);
  return { socket, snap: await snapshot };
}

test('TIME-3: a disconnect pauses, the partner gets attempt:paused and frozen ticks', async () => {
  room = await pauseRoom();
  const paused = nextEvent(room.a, 'attempt:paused');
  room.b.disconnect();
  expect(await paused).toMatchObject({
    who: { id: room.bob.user.id, name: 'bob', role: 'B' }, graceMs: expect.any(Number), clockStopped: true,
  });
  const ticks = await collect(room.a, 'attempt:tick', 350);
  expect(ticks.length).toBeGreaterThan(1);
  expect(new Set(ticks.map((t) => t.remainingMs)).size).toBe(1);
  expect(ticks[0]).toMatchObject({ paused: true, away: [{ id: room.bob.user.id, graceMs: expect.any(Number) }] });
  expect(ticks[0].away[0].graceMs).toBeLessThanOrEqual(400);
  expect((await Attempt.findById(room.attemptId)).status).toBe('paused');
});

test('CHAT-2: pause and resume are announced in chat with the role name', async () => {
  room = await pauseRoom({ graceMs: 2000 });
  const lost = nextEvent(room.a, 'chat:message');
  room.b.disconnect();
  expect((await lost).text).toBe('Decoder lost connection. Waiting 2 seconds for them to return.');
  const back = nextEvent(room.a, 'chat:message');
  await bobReturns();
  expect((await back).text).toBe('Decoder is back. Play resumed.');
});

test('TIME-4/TIME-6: reconnecting within the grace resumes and restores the full state', async () => {
  room = await pauseRoom({ graceMs: 2000 });
  expect(await submit(room.b, 1, 'WRONG')).toEqual({ ok: true });
  await ask(room.b, 'chat:send', { text: 'hello' });
  const paused = nextEvent(room.a, 'attempt:paused');
  room.b.disconnect();
  await paused;
  await wait(200);
  const resumed = nextEvent(room.a, 'attempt:resumed');
  const reconnectStartedAt = Date.now();
  const { snap } = await bobReturns();
  expect(Date.now() - reconnectStartedAt).toBeLessThan(2000); // NFR-8
  const res = await resumed;
  expect(res).toMatchObject({ who: { id: room.bob.user.id }, reason: 'RETURNED', remainingMs: expect.any(Number) });
  expect(snap.status).toBe('in_progress');
  expect(snap.clue).toEqual(room.snapB.clue);
  expect(snap.chat.map((m) => m.text)).toEqual(expect.arrayContaining(['hello']));
  expect(snap.levels[0].wrongCount).toBe(1);
  expect(snap.pause).toEqual({ clockStopped: false, away: [], budgetLeftMs: expect.any(Number) });
  expect(snap.pause.budgetLeftMs).toBeLessThan(2000);
  expect(new Date(res.endsAt).getTime()).toBeGreaterThan(new Date(room.snapB.endsAt).getTime() + 150);
});

test('a snapshot taken during a pause still shows the clue and the away teammate', async () => {
  room = await pauseRoom({ graceMs: 2000 });
  const paused = nextEvent(room.a, 'attempt:paused');
  room.b.disconnect();
  await paused;
  room.a.disconnect(); // alice refreshes too: both away now
  await wait(100);
  const again = await connect(room.srv.url, room.alice.token);
  const snapshot = nextEvent(again, 'attempt:snapshot');
  await join(again, room.code);
  const snap = await snapshot;
  expect(snap.status).toBe('paused');
  expect(snap.clue).toEqual(room.snapA.clue);
  expect(snap.levels[0].state).toBe('current');
  expect(snap.pause.clockStopped).toBe(true);
  expect(snap.pause.away).toEqual([expect.objectContaining({ id: room.bob.user.id, name: 'bob', role: 'B' })]);
});

test('TIME-5: no return within the grace ends the attempt early, points kept', async () => {
  room = await pauseRoom();
  expect(await submit(room.a, 1, ANSWERS[0])).toEqual({ ok: true });
  const ended = nextEvent(room.a, 'attempt:ended', 3000);
  const gone = [];
  room.a.on('chat:message', (m) => gone.push(m.text));
  room.b.disconnect();
  const end = await ended;
  expect(end.status).toBe('ended_early');
  expect(end.result.levels[0].solved).toBe(true);
  expect(end.result.total).toBe(100);
  expect(gone).toContain('Decoder did not return within 0 seconds.');
});

test('both players gone for the grace ends the attempt with nobody connected', async () => {
  room = await pauseRoom({ graceMs: 300 });
  room.a.disconnect();
  room.b.disconnect();
  await wait(900);
  expect((await Attempt.findById(room.attemptId)).status).toBe('ended_early');
  expect(room.srv.io.runtimes.size()).toBe(0);
});

test('D69: submit and hint while paused get ATTEMPT_PAUSED at no cost', async () => {
  room = await pauseRoom({ graceMs: 2000 });
  const paused = nextEvent(room.a, 'attempt:paused');
  room.b.disconnect();
  await paused;
  expect((await submit(room.a, 1, 'WRONG')).error).toBe('ATTEMPT_PAUSED');
  expect((await ask(room.a, 'hint:reveal', { order: 1 })).error).toBe('ATTEMPT_PAUSED');
  expect((await Attempt.findById(room.attemptId)).levels[0].wrongCount).toBe(0);
  expect((await ask(room.a, 'chat:send', { text: 'still here' })).ok).toBe(true);
});

test('Review Focus 1: closing one of two tabs does not pause', async () => {
  room = await pauseRoom();
  const second = await connect(room.srv.url, room.bob.token);
  await join(second, room.code);
  const paused = collect(room.a, 'attempt:paused', 300);
  const messages = collect(room.a, 'chat:message', 300);
  room.b.disconnect();
  expect(await paused).toEqual([]);
  expect(await messages).toEqual([]);
  expect((await Attempt.findById(room.attemptId)).status).toBe('in_progress');
});

test('Review Focus 2: the budget runs out mid-pause; the clock restarts, the grace still ends it', async () => {
  room = await pauseRoom({ graceMs: 800, pauseBudgetMs: 300 });
  const resumed = nextEvent(room.a, 'attempt:resumed', 2000);
  room.b.disconnect();
  expect(await resumed).toMatchObject({ who: null, reason: 'PAUSE_BUDGET_USED' });
  const ticks = await collect(room.a, 'attempt:tick', 250);
  expect(ticks[ticks.length - 1]).toMatchObject({ paused: false, away: [{ id: room.bob.user.id }] });
  expect(ticks[0].remainingMs).toBeGreaterThan(ticks[ticks.length - 1].remainingMs);
  expect((await nextEvent(room.a, 'attempt:ended', 2000)).status).toBe('ended_early');
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.pauseUsedMs).toBe(300);
});

test('with the budget used up, a disconnect reports clockStopped: false and ticks keep counting', async () => {
  room = await pauseRoom({ pauseBudgetMs: 0, graceMs: 2000 });
  const paused = nextEvent(room.a, 'attempt:paused');
  const msg = nextEvent(room.a, 'chat:message');
  room.b.disconnect();
  expect(await paused).toMatchObject({ clockStopped: false });
  expect((await msg).text).toBe('Decoder lost connection. Waiting 2 seconds for them to return. The pause budget is used up, so the clock keeps running.');
  const ticks = await collect(room.a, 'attempt:tick', 350);
  expect(ticks[0].remainingMs).toBeGreaterThan(ticks[ticks.length - 1].remainingMs);
  expect(ticks[0].paused).toBe(false);
});

test('Review Focus 3: a disconnect racing the final solve ends the attempt exactly once', async () => {
  room = await pauseRoom({ graceMs: 300 });
  for (let i = 0; i < 4; i += 1) expect(await submit(i % 2 ? room.b : room.a, i + 1, ANSWERS[i])).toEqual({ ok: true });
  const events = [];
  room.a.onAny((event, payload) => events.push([event, payload]));
  const final = submit(room.a, 5, ANSWERS[4]);
  room.b.disconnect();
  const ack = await final;
  await wait(900);
  const ended = events.filter(([e]) => e === 'attempt:ended');
  expect(ended).toHaveLength(1);
  const endIndex = events.findIndex(([e]) => e === 'attempt:ended');
  expect(events.slice(endIndex).some(([e]) => e === 'attempt:paused')).toBe(false);
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.status).toBe(ack.ok ? 'finished' : 'ended_early');
  expect(ended[0][1].status).toBe(saved.status);
});

test('§7.5: the hint delay excludes paused time', async () => {
  room = await pauseRoom({ hintDelayMs: 300, graceMs: 2000 });
  const startedAt = Date.now();
  const hint = nextEvent(room.a, 'hint:available', 3000);
  await wait(100);
  const paused = nextEvent(room.a, 'attempt:paused');
  room.b.disconnect();
  await paused;
  await wait(400);
  await bobReturns();
  await hint;
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(650);
});
