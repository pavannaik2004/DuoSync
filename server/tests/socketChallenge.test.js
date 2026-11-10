const request = require('supertest');
const Attempt = require('../src/models/Attempt');
const Challenge = require('../src/models/Challenge');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createGuest } = require('./helpers/users');
const { expectNoUnrevealedHint } = require('./helpers/leaks');
const { startSocketServer, connect, nextEvent, collect } = require('./helpers/sockets');
const {
  startedChallengeAttempt, createOpenChallenge, enterTeam, ask, submit,
} = require('./helpers/rooms');

const srvs = [];
let srv;
beforeAll(startDb);
beforeEach(seedThemes);
afterAll(stopDb);
afterEach(async () => {
  await Promise.all(srvs.splice(0).map((s) => s.close()));
  srv = null;
  await clearDb();
});

const server = async (options = {}) => {
  srv = await startSocketServer({ countdownMs: 50, tickMs: 100, submitGapMs: 0, ...options });
  srvs.push(srv);
  return srv;
};
const joinById = (socket, attemptId) => socket.emitWithAck('attempt:join', { attemptId });

/** Plays a started team through every level, alternating players; returns each role's clue per level. */
async function play(room, levels) {
  const clues = { A: [room.snapA.clue.clue], B: [room.snapB.clue.clue] };
  for (let i = 0; i < levels.length; i += 1) {
    const last = i === levels.length - 1;
    const next = last ? null : Promise.all([nextEvent(room.a, 'level:unlocked'), nextEvent(room.b, 'level:unlocked')]);
    expect(await submit(i % 2 ? room.b : room.a, i + 1, levels[i].answer)).toEqual({ ok: true });
    if (next) {
      const [ua, ub] = await next;
      clues.A.push(ua.clue);
      clues.B.push(ub.clue);
    }
  }
  return clues;
}

test('Gate: two teams in one challenge get identical clue halves for every level', async () => {
  await server();
  const one = await startedChallengeAttempt({ srv });
  const two = await startedChallengeAttempt({ srv, challenge: one.challenge, names: ['carol', 'dave'] });
  const { levels } = (await Challenge.findById(one.challenge.id)).toObject();
  expect(levels).toHaveLength(5);
  const [c1, c2] = [await play(one, levels), await play(two, levels)];
  expect(c1.A).toHaveLength(5);
  expect(c1.A).toEqual(c2.A);
  expect(c1.B).toEqual(c2.B);
  expect(c1.B).toEqual(levels.map((l) => l.clueB));
  expect(c1.A).toEqual(levels.map((l) => l.clueA));
  expect((await Attempt.findById(one.attemptId)).status).toBe('finished');
  expect((await Attempt.findById(two.attemptId)).status).toBe('finished');
});

test('a teammate opens the lobby: entered → lobby; snapshot has the theme snapshot and no answers', async () => {
  await server();
  const room = await startedChallengeAttempt({ srv, ready: false });
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.status).toBe('lobby');
  const again = await connect(srv.url, room.alice.token);
  const pending = nextEvent(again, 'attempt:snapshot');
  await joinById(again, room.attemptId);
  const snap = await pending;
  expect(snap.status).toBe('lobby');
  expect(snap.theme.slug).toBe('cyber-heist');
  expect(snap.theme.name).toBe(saved.theme.name);
  const json = JSON.stringify(snap);
  for (const banned of ['"answer"', 'acceptedAnswers', 'explanation', 'clueB', 'seed']) expect(json).not.toContain(banned);
  expectNoUnrevealedHint([snap], (await Challenge.findById(room.challenge.id)).levels);
});

test('NFR-1: a started challenge attempt sends no hint text to either player before a reveal', async () => {
  await server();
  const room = await startedChallengeAttempt({ srv });
  const got = [];
  room.a.onAny((e, p) => got.push([e, p]));
  room.b.onAny((e, p) => got.push([e, p]));
  expect(await submit(room.a, 1, (await Challenge.findById(room.challenge.id)).levels[0].answer)).toEqual({ ok: true });
  expectNoUnrevealedHint([room.snapA, room.snapB, ...got], (await Challenge.findById(room.challenge.id)).levels);
});

test('a non-member socket → NOT_IN_ATTEMPT; a guest → GUEST_NOT_ALLOWED; both attemptId and practiceCode → VALIDATION_ERROR', async () => {
  await server();
  const room = await startedChallengeAttempt({ srv, ready: false });
  const carol = await createPlayer(srv.app, 'carol');
  const c = await connect(srv.url, carol.token);
  expect(await joinById(c, room.attemptId)).toMatchObject({ error: 'NOT_IN_ATTEMPT' });
  const guest = await createGuest(srv.app);
  const g = await connect(srv.url, guest.token);
  expect(await joinById(g, room.attemptId)).toMatchObject({ error: 'GUEST_NOT_ALLOWED' });
  expect(await room.a.emitWithAck('attempt:join', { attemptId: room.attemptId, practiceCode: 'ABC234' })).toMatchObject({ error: 'VALIDATION_ERROR' });
  expect(await room.a.emitWithAck('attempt:join', {})).toMatchObject({ error: 'VALIDATION_ERROR' });
  expect(await joinById(c, 'nope')).toMatchObject({ error: 'ATTEMPT_NOT_FOUND' });
  expect(await joinById(c, '507f1f77bcf86cd799439011')).toMatchObject({ error: 'ATTEMPT_NOT_FOUND' });
});

test('before startsAt → NOT_OPEN; an un-started team after endsAt → CHALLENGE_CLOSED', async () => {
  await server();
  const creator = await createPlayer(srv.app, 'owner');
  const future = await createOpenChallenge(srv.app, creator.auth, { startsInMs: 3 * 60 * 60e3, endsInMs: 4 * 60 * 60e3 });
  const early = await enterTeam(srv.app, future.id, ['alice', 'bob']);
  const a = await connect(srv.url, early.p1.token);
  const res = await joinById(a, early.attemptId);
  expect(res.error).toBe('NOT_OPEN');
  const startsAt = (await Challenge.findById(future.id)).startsAt.toISOString();
  expect(res.message).toContain(startsAt);
  expect((await Attempt.findById(early.attemptId)).status).toBe('entered');

  const open = await createOpenChallenge(srv.app, creator.auth);
  const late = await enterTeam(srv.app, open.id, ['carol', 'dave']);
  await Challenge.updateOne({ _id: open.id }, { endsAt: new Date(Date.now() - 1000) });
  const c = await connect(srv.url, late.p1.token);
  expect((await joinById(c, late.attemptId)).error).toBe('CHALLENGE_CLOSED');
});

test('Review Focus 2: the window closes during the countdown → back to lobby with a system message', async () => {
  await server({ countdownMs: 300 });
  const room = await startedChallengeAttempt({ srv, ready: false });
  await room.a.emitWithAck('lobby:claimRole', { role: 'A' });
  await room.b.emitWithAck('lobby:claimRole', { role: 'B' });
  await room.a.emitWithAck('lobby:ready');
  const chat = nextEvent(room.b, 'chat:message');
  const lobby = collect(room.b, 'lobby:update', 700);
  await room.b.emitWithAck('lobby:ready');
  await Challenge.updateOne({ _id: room.challenge.id }, { endsAt: new Date(Date.now() - 1000) });
  expect((await chat).text).toBe('The challenge window has closed. This attempt can no longer start.');
  const updates = await lobby;
  expect(updates[updates.length - 1].players.every((p) => !p.ready)).toBe(true);
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.status).toBe('lobby');
  expect(saved.levels).toHaveLength(0);
});

test('an attempt started 1 minute before endsAt keeps its full timer (CHAL-7)', async () => {
  await server({ countdownMs: 50 });
  const room = await startedChallengeAttempt({ srv, endsInMs: 60 * 1000 });
  const attempt = await Attempt.findById(room.attemptId);
  expect(attempt.status).toBe('in_progress');
  expect(new Date(attempt.endsAt) - new Date(attempt.startedAt)).toBe(attempt.theme.timerMinutes * 60000);
  expect(attempt.levels.map((l) => l.answer)).toEqual((await Challenge.findById(room.challenge.id)).levels.map((l) => l.answer));
});

test('a finished team cannot play again: joining shows the result and lobby:ready is refused', async () => {
  await server();
  const room = await startedChallengeAttempt({ srv });
  const { levels } = (await Challenge.findById(room.challenge.id)).toObject();
  const ended = nextEvent(room.a, 'attempt:ended');
  await play(room, levels);
  await ended;
  const again = await connect(srv.url, room.alice.token);
  const snap = nextEvent(again, 'attempt:snapshot');
  expect(await joinById(again, room.attemptId)).toEqual({ ok: true });
  expect((await snap).status).toBe('finished');
  expect(await again.emitWithAck('lobby:ready')).toMatchObject({ error: 'NOT_IN_LOBBY' });
  expect((await Attempt.findById(room.attemptId)).status).toBe('finished');
});

test('Task 8 Review Focus 4 + NFR-4: a removed partner is evicted from the room, gets NOT_IN_ATTEMPT, and the remaining player cannot start alone', async () => {
  await server();
  const room = await startedChallengeAttempt({ srv, ready: false });
  const attempt = await Attempt.findById(room.attemptId);
  const removed = nextEvent(room.b, 'attempt:removed');
  const lobbyForA = nextEvent(room.a, 'lobby:update');
  const res = await request(srv.app).delete(`/api/teams/${attempt.teamId}/members/${room.bob.user.id}`).set('Authorization', room.alice.auth);
  expect(res.status).toBe(204);
  expect(await removed).toEqual({ attemptId: room.attemptId, reason: 'REMOVED_FROM_TEAM' });
  expect((await lobbyForA).players).toHaveLength(1);

  const chatsB = collect(room.b, 'chat:message', 300);
  const lobbyB = collect(room.b, 'lobby:update', 300);
  const anyB = collect(room.b, 'attempt:snapshot', 300);
  const chatA = nextEvent(room.a, 'chat:message');
  expect(await room.a.emitWithAck('chat:send', { text: 'hello?' })).toEqual({ ok: true });
  expect((await chatA).text).toBe('hello?');
  expect(await room.b.emitWithAck('lobby:ready')).toMatchObject({ error: 'NOT_IN_ATTEMPT' });
  expect(await chatsB).toEqual([]);
  expect(await lobbyB).toEqual([]);
  expect(await anyB).toEqual([]);

  expect(await room.a.emitWithAck('lobby:claimRole', { role: 'A' })).toEqual({ ok: true });
  const snaps = collect(room.a, 'attempt:snapshot', 300);
  expect(await ask(room.a, 'lobby:ready')).toEqual({ ok: true });
  expect(await snaps).toEqual([]);
  const saved = await Attempt.findById(room.attemptId);
  expect(saved.status).toBe('lobby');
  expect(saved.players).toHaveLength(1);
});

test('final review 2: a removal that lands between openAttempt and the queued join keeps the player out of the room', async () => {
  await server();
  const creator = await createPlayer(srv.app, 'ownerx');
  const challenge = await createOpenChallenge(srv.app, creator.auth, {});
  const team = await enterTeam(srv.app, challenge.id, ['alice', 'bob']);
  const b = await connect(srv.url, team.p2.token);
  const runtime = srv.io.runtimes.get(team.attemptId);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  runtime.enqueue(() => gate); // holds the queue while the join passes openAttempt
  const ack = joinById(b, team.attemptId);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await Attempt.updateOne({ _id: team.attemptId }, { $pull: { memberIds: team.p2.user.id, players: { id: team.p2.user.id } } });
  release();
  expect(await ack).toMatchObject({ error: 'NOT_IN_ATTEMPT' });
  expect(runtime.sockets.get(team.p2.user.id)?.size || 0).toBe(0);
});
