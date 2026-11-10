const Attempt = require('../src/models/Attempt');
const cyberHeist = require('../src/content').getContent('cyber-heist');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { connect, nextEvent, join, wait } = require('./helpers/sockets');
const { startedRoom, ask, submit } = require('./helpers/rooms');

const ANSWERS = ['9742', 'FIREWALL', '23-12-4', '8315', 'NODE'];
let room;

beforeAll(startDb);
afterAll(stopDb);
afterEach(async () => {
  if (room) await room.srv.close();
  room = null;
  await clearDb();
});

/** Solves levels 1..n, alternating players. */
async function solveUpTo(n) {
  for (let i = 0; i < n; i += 1) {
    expect(await submit(i % 2 ? room.b : room.a, i + 1, ANSWERS[i])).toEqual({ ok: true });
  }
}

test('full run: both players see the same results', async () => {
  room = await startedRoom();
  const ended = Promise.all([nextEvent(room.a, 'attempt:ended'), nextEvent(room.b, 'attempt:ended')]);
  await solveUpTo(5);
  const [endA, endB] = await ended;
  expect(endA).toEqual(endB);
  expect(endA.status).toBe('finished');
  expect(endA.result).toMatchObject({ status: 'finished', levelsCleared: 5, levelPoints: 500, stars: 3, wrongAnswers: 0 });
  expect(endA.result.bonus).toBeGreaterThan(170); // about 14:59 left → 179
  expect(endA.result.total).toBe(500 + endA.result.bonus);
  expect(endA.result.text).toBe(cyberHeist.theme.revealText);
  const saved = await Attempt.findById(room.attemptId);
  expect(saved).toMatchObject({ status: 'finished', totalPoints: endA.result.total, levelsCleared: 5, stars: 3 });
  const [aliceId, bobId] = [room.alice.user.id, room.bob.user.id];
  expect(saved.levels.map((l) => l.solvedBy)).toEqual([aliceId, bobId, aliceId, bobId, aliceId]);
});

test('wrong answer: both see the text and −10, the level stays open, points later reflect it', async () => {
  room = await startedRoom();
  const results = Promise.all([nextEvent(room.a, 'level:result'), nextEvent(room.b, 'level:result')]);
  const chat = nextEvent(room.b, 'chat:message');
  expect(await submit(room.a, 1, ' 1234 ')).toEqual({ ok: true });
  const [resA, resB] = await results;
  expect(resA).toEqual(resB);
  expect(resA).toEqual({
    order: 1,
    correct: false,
    text: '1234',
    deduction: 10,
    wrongCount: 1,
    submittedBy: { id: room.alice.user.id, name: 'alice', role: 'A' },
  });
  expect((await chat).text).toBe('Wrong answer "1234" from Hacker (−10)');

  const solved = nextEvent(room.b, 'level:result');
  await submit(room.b, 1, '9742');
  expect(await solved).toMatchObject({ order: 1, correct: true, points: 90, text: '9742' });
});

test('answers are normalized: "23, 12, 4" solves Server Reboot', async () => {
  room = await startedRoom();
  await solveUpTo(2);
  const res = nextEvent(room.a, 'level:result');
  await submit(room.a, 3, '23, 12, 4');
  expect(await res).toMatchObject({ order: 3, correct: true });
});

test('simultaneous correct answers produce one solve and one award', async () => {
  room = await startedRoom();
  const results = [];
  room.a.on('level:result', (r) => results.push(r));
  const acks = await Promise.all([submit(room.a, 1, '9742'), submit(room.b, 1, '9742')]);
  await wait(300);
  expect(results.filter((r) => r.correct)).toHaveLength(1);
  expect(acks.filter((x) => x.ignored)).toHaveLength(1);
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.levels[0].points).toBe(100);
  expect(saved.levelsCleared).toBe(1);
  expect(saved.board).toHaveLength(1);
});

test('an answer for an already solved or a future level is ignored', async () => {
  room = await startedRoom();
  await solveUpTo(1);
  expect(await submit(room.b, 1, '9742')).toEqual({ ok: true, ignored: true });
  expect(await submit(room.b, 3, '23-12-4')).toEqual({ ok: true, ignored: true });
  expect((await Attempt.findById(room.attemptId)).levels[1].wrongCount).toBe(0);
});

test('level:unlocked gives each player only their own half', async () => {
  room = await startedRoom();
  const unlocked = Promise.all([nextEvent(room.a, 'level:unlocked'), nextEvent(room.b, 'level:unlocked')]);
  await solveUpTo(1);
  const [ua, ub] = await unlocked;
  expect(ua).toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueA });
  expect(ub).toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueB });
  expect(JSON.stringify(ua)).not.toContain('Shift every letter back');
});

test('board:update carries the reward fragment, the running score and the level bar', async () => {
  room = await startedRoom();
  const board = nextEvent(room.b, 'board:update');
  await solveUpTo(1);
  const update = await board;
  expect(update.board).toEqual([{ order: 1, title: 'Access PIN', reward: 'D' }]);
  expect(update.score).toBe(100);
  expect(update.levels.map((l) => l.state)).toEqual(['solved', 'current', 'locked', 'locked', 'locked']);
});

test('rate limit: a second submission within 2 s → RATE_LIMITED and no wrong count', async () => {
  room = await startedRoom({ submitGapMs: 2000 });
  expect(await submit(room.a, 1, '1111')).toEqual({ ok: true });
  expect(await submit(room.a, 1, '2222')).toMatchObject({ error: 'RATE_LIMITED' });
  expect(await submit(room.b, 1, '3333')).toEqual({ ok: true }); // the limit is per player
  expect((await Attempt.findById(room.attemptId)).levels[0].wrongCount).toBe(2);
});

test.each([
  [{ order: 1, answer: { $ne: null } }],
  [{ order: 1, answer: 'x'.repeat(41) }],
  [{ order: 1, answer: '   ' }],
  [{ order: '1', answer: '9742' }],
  [{ order: 6, answer: '9742' }],
])('submit validation %p → VALIDATION_ERROR', async (payload) => {
  room = await startedRoom();
  expect(await ask(room.a, 'level:submit', payload)).toMatchObject({ error: 'VALIDATION_ERROR' });
  expect(await submit(room.a, 1, '9742')).toEqual({ ok: true });
});

test('after quit: ended_early keeps earned points; a later submit → ATTEMPT_OVER', async () => {
  room = await startedRoom();
  await solveUpTo(1);
  const ended = nextEvent(room.b, 'attempt:ended');
  expect(await ask(room.a, 'attempt:quit')).toEqual({ ok: true });
  const end = await ended;
  expect(end.status).toBe('ended_early');
  expect(end.result).toMatchObject({ total: 100, levelsCleared: 1, bonus: 0, stars: 0, text: cyberHeist.theme.failText });
  expect(await submit(room.b, 2, 'FIREWALL')).toMatchObject({ error: 'ATTEMPT_OVER' });
  expect(await ask(room.b, 'attempt:quit')).toMatchObject({ error: 'ATTEMPT_OVER' });
  expect((await Attempt.findById(room.attemptId)).totalPoints).toBe(100);
});

test('after the timer runs out a submit → ATTEMPT_OVER and totals do not change', async () => {
  room = await startedRoom({ timerMs: 400 });
  await nextEvent(room.a, 'attempt:ended', 3000);
  expect(await submit(room.a, 1, '9742')).toMatchObject({ error: 'ATTEMPT_OVER' });
  const saved = await Attempt.findById(room.attemptId);
  expect(saved).toMatchObject({ status: 'timed_out', totalPoints: 0, levelsCleared: 0 });
});

test('a reconnect mid-attempt gets the snapshot: same role, own current clue, score and chat', async () => {
  room = await startedRoom();
  await solveUpTo(1);
  room.a.disconnect();
  const again = await connect(room.srv.url, room.alice.token);
  const snapshot = nextEvent(again, 'attempt:snapshot');
  await join(again, room.code);
  const snap = await snapshot;
  expect(snap).toMatchObject({ status: 'in_progress', me: { role: 'A' }, score: 100 });
  expect(snap.clue).toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueA });
  expect(snap.chat.some((m) => m.text === 'Access PIN solved: +100')).toBe(true);
});

test('NFR-1: nothing player A receives during a full run contains a B half or an answer field', async () => {
  room = await startedRoom();
  const received = [];
  room.a.onAny((event, payload) => received.push([event, payload]));
  const ended = nextEvent(room.a, 'attempt:ended');
  await solveUpTo(5);
  await ended;
  const json = JSON.stringify([room.snapA, ...received]);
  for (const banned of ['"answer"', 'acceptedAnswers', 'explanation', '"hint"', 'clueB', 'answerKind']) {
    expect(json).not.toContain(banned);
  }
  for (const level of cyberHeist.levels) expect(json).not.toContain(JSON.stringify(level.clueB.data));
});

test('a finished attempt with nobody connected drops its runtime', async () => {
  room = await startedRoom({ timerMs: 300 });
  expect(room.srv.io.runtimes.size()).toBe(1);
  room.a.disconnect();
  room.b.disconnect();
  await wait(700);
  expect((await Attempt.findById(room.attemptId)).status).toBe('timed_out');
  expect(room.srv.io.runtimes.size()).toBe(0);
});

test('level:submit before the start says NOT_STARTED', async () => {
  const { createPlayer, createRoom } = require('./helpers/users');
  const { startSocketServer } = require('./helpers/sockets');
  const srv = await startSocketServer();
  room = { srv };
  const alice = await createPlayer(srv.app, 'alice');
  const code = await createRoom(srv.app, alice.auth);
  const a = await connect(srv.url, alice.token);
  await join(a, code);
  expect(await submit(a, 1, '9742')).toMatchObject({ error: 'NOT_STARTED' });
});
