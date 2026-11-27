/** PRAC-4 / D92: practice rooms with no activity for 30 minutes expire. */
const request = require('supertest');
const { createApp } = require('../src/app');
const Attempt = require('../src/models/Attempt');
const Message = require('../src/models/Message');
const { expireIdlePractice, joinPractice, PRACTICE_IDLE_MS } = require('../src/services/practiceService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createRoom } = require('./helpers/users');
const { startSocketServer, connect, join, nextEvent, wait } = require('./helpers/sockets');

const app = createApp({ authRateLimit: 1000 });
const MIN = 60 * 1000;

beforeAll(startDb);
beforeEach(async () => { await clearDb(); await seedThemes(); });
afterAll(stopDb);

let n = 0;
/** A practice room straight in the DB whose last activity was `idleMin` minutes before `now`. */
async function room({ status = 'lobby', idleMin, now = Date.now(), legacy = false }) {
  n += 1;
  const doc = await Attempt.create({
    practiceCode: `PRAC${'ABCDEFGHJK'[n % 10]}${'23456789'[n % 8]}`,
    themeSlug: 'cyber-heist',
    status,
    players: [{ id: `guest_${n}`, kind: 'guest', name: 'Visitor_9' }],
    lastActivityAt: legacy ? undefined : new Date(now - idleMin * MIN),
  });
  if (legacy) {
    await Attempt.collection.updateOne({ _id: doc._id }, { $unset: { lastActivityAt: '' }, $set: { updatedAt: new Date(now - idleMin * MIN) } });
  }
  await Message.create({ attemptId: doc._id, kind: 'system', text: 'Visitor_9 joined' });
  return doc;
}

test('PRACTICE_IDLE_MS is 30 minutes', () => {
  expect(PRACTICE_IDLE_MS).toBe(30 * MIN);
});

test('a lobby room idle 31 min with no socket is deleted with its messages', async () => {
  const now = Date.now();
  const r = await room({ idleMin: 31, now });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 1, released: 0 });
  expect(await Attempt.findById(r._id)).toBeNull();
  expect(await Message.countDocuments({ attemptId: r._id })).toBe(0);
});

test('a countdown room idle 31 min is deleted too', async () => {
  const now = Date.now();
  await room({ status: 'countdown', idleMin: 31, now });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 1, released: 0 });
});

test('a lobby room idle 29 min is kept', async () => {
  const now = Date.now();
  const r = await room({ idleMin: 29, now });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 0, released: 0 });
  expect(await Attempt.findById(r._id)).not.toBeNull();
});

test('a room with a connected socket is kept however old', async () => {
  const now = Date.now();
  const r = await room({ idleMin: 600, now });
  const isLive = (id) => String(id) === String(r._id);
  expect(await expireIdlePractice(now, { isLive })).toEqual({ deleted: 0, released: 0 });
});

test('a finished room keeps its result but its code no longer resolves', async () => {
  const player = await createPlayer(app, 'alice');
  const code = await createRoom(app, player.auth);
  const now = Date.now();
  await Attempt.updateOne({ practiceCode: code }, {
    status: 'finished', finishedAt: new Date(now - 40 * MIN), lastActivityAt: new Date(now - 40 * MIN),
  });
  const { _id } = await Attempt.findOne({ practiceCode: code });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 0, released: 1 });
  const result = await request(app).get(`/api/attempts/${_id}/result`).set('Authorization', player.auth);
  expect(result.status).toBe(200);
  const preview = await request(app).get(`/api/practice/${code}`).set('Authorization', player.auth);
  expect([preview.status, preview.body.error]).toEqual([404, 'PRACTICE_NOT_FOUND']);
  expect(await Message.countDocuments({ attemptId: _id })).toBeGreaterThanOrEqual(0);
});

test.each(['in_progress', 'paused'])('a %s room is left alone', async (status) => {
  const now = Date.now();
  const r = await room({ status, idleMin: 90, now });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 0, released: 0 });
  expect((await Attempt.findById(r._id)).practiceCode).toBe(r.practiceCode);
});

test('challenge attempts are never touched', async () => {
  const now = Date.now();
  const r = await room({ idleMin: 90, now });
  await Attempt.collection.updateOne({ _id: r._id }, { $unset: { practiceCode: '' }, $set: { challengeId: r._id } });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 0, released: 0 });
});

test('rooms made before this phase use updatedAt', async () => {
  const now = Date.now();
  const old = await room({ idleMin: 40, now, legacy: true });
  const fresh = await room({ idleMin: 5, now, legacy: true });
  expect(await expireIdlePractice(now)).toEqual({ deleted: 1, released: 0 });
  expect(await Attempt.findById(old._id)).toBeNull();
  expect(await Attempt.findById(fresh._id)).not.toBeNull();
});

test('a join that refreshes lastActivityAt after the sweep found the room keeps it', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const code = await createRoom(app, alice.auth);
  const now = Date.now();
  await Attempt.updateOne({ practiceCode: code }, { lastActivityAt: new Date(now - 31 * MIN) });
  const realFind = Attempt.find.bind(Attempt);
  const spy = jest.spyOn(Attempt, 'find').mockImplementationOnce((...args) => {
    const query = realFind(...args);
    const exec = query.exec.bind(query);
    query.exec = async () => {
      const found = await exec();
      await joinPractice(code, { id: bob.user.id, kind: 'user', name: 'bob' });
      return found;
    };
    return query;
  });
  // the sweep runs "now"; the join stamped the real clock, which is later than the cutoff
  expect(await expireIdlePractice(now)).toEqual({ deleted: 0, released: 0 });
  spy.mockRestore();
  const after = await Attempt.findOne({ practiceCode: code });
  expect(after.players.map((p) => p.name)).toEqual(['alice', 'bob']);
});

test('creating and joining a room set lastActivityAt', async () => {
  const alice = await createPlayer(app, 'alice');
  const bob = await createPlayer(app, 'bob');
  const code = await createRoom(app, alice.auth);
  const created = (await Attempt.findOne({ practiceCode: code })).lastActivityAt;
  expect(created).toBeInstanceOf(Date);
  await Attempt.updateOne({ practiceCode: code }, { lastActivityAt: new Date(0) });
  await joinPractice(code, { id: bob.user.id, kind: 'user', name: 'bob' });
  expect((await Attempt.findOne({ practiceCode: code })).lastActivityAt.getTime()).toBeGreaterThan(Date.now() - MIN);
});

test('the last socket leaving a practice room sets lastActivityAt', async () => {
  const srv = await startSocketServer();
  try {
    const alice = await createPlayer(srv.app, 'alice');
    const code = await createRoom(srv.app, alice.auth);
    const a = await connect(srv.url, alice.token);
    const snap = nextEvent(a, 'attempt:snapshot');
    await join(a, code);
    await snap;
    await Attempt.updateOne({ practiceCode: code }, { lastActivityAt: new Date(0) });
    a.disconnect();
    let stamped = null;
    for (let i = 0; i < 40 && !stamped; i += 1) {
      await wait(50);
      const doc = await Attempt.findOne({ practiceCode: code });
      if (doc.lastActivityAt.getTime() > 0) stamped = doc.lastActivityAt;
    }
    expect(stamped).not.toBeNull();
  } finally {
    await srv.close();
  }
});

test('the socket server sweeps on its own when practiceSweepMs is set', async () => {
  const now = Date.now();
  const r = await room({ idleMin: 31, now });
  const srv = await startSocketServer({ practiceSweepMs: 50 });
  try {
    let gone = false;
    for (let i = 0; i < 40 && !gone; i += 1) {
      await wait(50);
      gone = !(await Attempt.findById(r._id));
    }
    expect(gone).toBe(true);
  } finally {
    await srv.close();
  }
});
