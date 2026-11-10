const Attempt = require('../src/models/Attempt');
const { levelPoints } = require('../src/services/scoring');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { connect, nextEvent, collect, join, wait } = require('./helpers/sockets');
const { startedRoom, ask } = require('./helpers/rooms');

let room;

beforeAll(startDb);
beforeEach(seedThemes);
afterAll(stopDb);
afterEach(async () => {
  if (room) await room.srv.close();
  room = null;
  await clearDb();
});

const reveal = (socket, order = 1) => ask(socket, 'hint:reveal', { order });

test('hint:available arrives after hintDelayMs, with a chat message, once', async () => {
  room = await startedRoom({ hintDelayMs: 300 });
  const started = Date.now();
  const chat = collect(room.b, 'chat:message', 900);
  const events = collect(room.a, 'hint:available', 900);
  const [msgs, got] = await Promise.all([chat, events]);
  expect(got).toEqual([{ order: 1 }]);
  expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  expect(msgs.filter((m) => m.text === 'Hint ready for Access PIN')).toHaveLength(1);
});

test('Review Focus 5: revealing before ready → HINT_NOT_READY, nothing deducted', async () => {
  room = await startedRoom({ hintDelayMs: 60000 });
  const res = await reveal(room.a);
  expect(res).toMatchObject({ error: 'HINT_NOT_READY' });
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.levels[0].hintRevealedAt).toBeNull();
});

test('Review Focus 5: both reveal at once → one hint:revealed, and the level scores −25 once', async () => {
  room = await startedRoom({ hintDelayMs: 100 });
  await nextEvent(room.a, 'hint:available');
  const revealed = [];
  room.a.on('hint:revealed', (r) => revealed.push(r));
  room.b.on('hint:revealed', (r) => revealed.push(r));
  const chat = [];
  room.b.on('chat:message', (m) => chat.push(m.text));
  const acks = await Promise.all([reveal(room.a), reveal(room.b)]);
  await wait(200);
  expect(acks.filter((r) => r.ignored)).toHaveLength(1);
  expect(revealed).toHaveLength(2); // one broadcast, seen by both players
  expect(revealed[0]).toEqual(revealed[1]);
  expect(revealed[0].order).toBe(1);
  expect(typeof revealed[0].hint).toBe('string');
  expect(chat.filter((t) => /revealed the hint \(−25\)$/.test(t))).toHaveLength(1);

  const result = nextEvent(room.a, 'level:result');
  await ask(room.a, 'level:submit', { order: 1, answer: room.answers ? room.answers[0] : '9742' });
  const solved = await result;
  const saved = await Attempt.findById(room.attemptId);
  expect(solved.correct).toBe(true);
  expect(saved.levels[0].points).toBe(levelPoints({ activeMs: saved.levels[0].activeMs, wrongCount: 0, hintUsed: true }));
});

test('a reconnecting player sees the revealed hint text in the snapshot', async () => {
  room = await startedRoom({ hintDelayMs: 100 });
  await nextEvent(room.a, 'hint:available');
  const revealed = nextEvent(room.b, 'hint:revealed');
  expect(await reveal(room.a)).toEqual({ ok: true });
  const { hint } = await revealed;
  const b2 = await connect(room.srv.url, room.bob.token);
  const snap = nextEvent(b2, 'attempt:snapshot');
  await join(b2, room.code);
  expect((await snap).clue.hint).toEqual({ ready: true, text: hint });
});

test('no hint:available is sent after the level is solved before the delay', async () => {
  room = await startedRoom({ hintDelayMs: 400 });
  const early = collect(room.a, 'hint:available', 700);
  await ask(room.a, 'level:submit', { order: 1, answer: '9742' });
  const got = await early;
  expect(got.map((g) => g.order)).not.toContain(1);
});
