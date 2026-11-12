const Attempt = require('../src/models/Attempt');
const Challenge = require('../src/models/Challenge');
const { rankCompare } = require('../src/services/scoring');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createGuest } = require('./helpers/users');
const {
  startSocketServer, connect, nextEvent, collect, waitFor, join,
} = require('./helpers/sockets');
const {
  startedRoom, startedChallengeAttempt, createOpenChallenge, ask, submit,
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
  srv = await startSocketServer({
    countdownMs: 50, tickMs: 100, submitGapMs: 0, leaderboardDelayMs: 50, ...options,
  });
  srvs.push(srv);
  return srv;
};

/** A 4th player, not on any team, watching the challenge's leaderboard. Resolves with { socket, board }. */
async function watcher(challengeId, name = 'watcher') {
  const player = await createPlayer(srv.app, name);
  const socket = await connect(srv.url, player.token);
  const ack = await ask(socket, 'leaderboard:watch', { challengeId });
  return { socket, ack, board: ack.board };
}

const answersOf = async (challengeId) => (await Challenge.findById(challengeId)).levels.map((l) => l.answer);

/** Solves levels from..to (1-based) for a started team, alternating players. */
async function solve(team, answers, from, to) {
  for (let i = from - 1; i < to; i += 1) {
    expect(await submit(i % 2 ? team.b : team.a, i + 1, answers[i])).toEqual({ ok: true });
  }
}

test('Gate: 3 teams finish one challenge and the live board ranks them by §7.3', async () => {
  await server();
  const clean = await startedChallengeAttempt({ srv });
  const { challenge } = clean;
  const twoWrong = await startedChallengeAttempt({ srv, challenge, names: ['carol', 'dave'] });
  const quitter = await startedChallengeAttempt({ srv, challenge, names: ['erin', 'frank'] });
  const watch = await watcher(challenge.id);
  expect(watch.board.playing).toHaveLength(3);
  const answers = await answersOf(challenge.id);

  const final = waitFor(watch.socket, 'leaderboard:update', (b) => b.ranked.length === 3, 8000);
  await solve(quitter, answers, 1, 3);
  expect(await ask(quitter.a, 'attempt:quit')).toEqual({ ok: true });
  expect(await submit(twoWrong.a, 1, 'WRONG')).toEqual({ ok: true });
  expect(await submit(twoWrong.b, 1, 'NOPE')).toEqual({ ok: true });
  await solve(twoWrong, answers, 1, 5);
  await solve(clean, answers, 1, 5);
  const board = await final;

  expect(board.ranked.map((r) => r.teamName)).toEqual(['alice and bob', 'carol and dave', 'erin and frank']);
  expect(board.ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  expect(board.ranked[2]).toMatchObject({ status: 'ended_early', levelsCleared: 3, points: 300 });
  const saved = await Attempt.find({ challengeId: challenge.id });
  const sorted = [...saved].sort(rankCompare);
  expect(board.ranked.map((r) => r.points)).toEqual(sorted.map((a) => a.totalPoints));
  expect(board.ranked.map((r) => r.teamId)).toEqual(sorted.map((a) => String(a.teamId)));
  expect(board.provisional).toBe(true);
  expect(board.playing).toEqual([]);
});

test('SCORE-4: a team that starts or solves appears in playing with its level', async () => {
  await server();
  const owner = await createPlayer(srv.app, 'owner');
  const challenge = await createOpenChallenge(srv.app, owner.auth);
  const watch = await watcher(challenge.id);
  expect(watch.board).toMatchObject({ ranked: [], playing: [], waiting: [] });
  const started = waitFor(watch.socket, 'leaderboard:update', (b) => b.playing.length === 1);
  const team = await startedChallengeAttempt({ srv, challenge });
  expect((await started).playing[0]).toMatchObject({ teamName: 'alice and bob', levelReached: 1, paused: false });
  const solved = waitFor(watch.socket, 'leaderboard:update', (b) => b.playing[0] && b.playing[0].levelReached === 2);
  await solve(team, await answersOf(challenge.id), 1, 1);
  await solved;
});

test('a pause shows on the board', async () => {
  await server({ graceMs: 5000 });
  const team = await startedChallengeAttempt({ srv });
  const watch = await watcher(team.challenge.id);
  const paused = waitFor(watch.socket, 'leaderboard:update', (b) => b.playing[0] && b.playing[0].paused);
  team.b.disconnect();
  await paused;
});

test('updates are coalesced: 3 quick changes give 1 leaderboard:update', async () => {
  await server({ leaderboardDelayMs: 200 });
  const owner = await createPlayer(srv.app, 'owner');
  const challenge = await createOpenChallenge(srv.app, owner.auth);
  const watch = await watcher(challenge.id);
  const updates = collect(watch.socket, 'leaderboard:update', 500);
  srv.io.leaderboards.changed(challenge.id);
  srv.io.leaderboards.changed(challenge.id);
  srv.io.leaderboards.changed(challenge.id);
  expect(await updates).toHaveLength(1);
});

test('NFR-4: the leaderboard room never gets chat, clue or game events', async () => {
  await server();
  const team = await startedChallengeAttempt({ srv });
  const watch = await watcher(team.challenge.id);
  const seen = [];
  watch.socket.onAny((event) => seen.push(event));
  const ended = nextEvent(team.a, 'attempt:ended');
  await ask(team.a, 'chat:send', { text: 'secret plan' });
  await solve(team, await answersOf(team.challenge.id), 1, 5);
  await ended;
  await waitFor(watch.socket, 'leaderboard:update', (b) => b.ranked.length === 1);
  expect(new Set(seen)).toEqual(new Set(['leaderboard:update']));
});

test('a socket watches one challenge at a time', async () => {
  await server();
  const owner = await createPlayer(srv.app, 'owner');
  const one = await createOpenChallenge(srv.app, owner.auth);
  const two = await createOpenChallenge(srv.app, owner.auth);
  const watch = await watcher(one.id);
  expect((await ask(watch.socket, 'leaderboard:watch', { challengeId: two.id })).ok).toBe(true);
  const updates = collect(watch.socket, 'leaderboard:update', 300);
  srv.io.leaderboards.changed(one.id);
  srv.io.leaderboards.changed(two.id);
  expect((await updates).map((b) => b.challengeId)).toEqual([two.id]);
});

test('SCORE-2: attempt:ended carries the current rank, and a later snapshot recomputes it', async () => {
  await server();
  const team = await startedChallengeAttempt({ srv });
  const ended = nextEvent(team.a, 'attempt:ended');
  await solve(team, await answersOf(team.challenge.id), 1, 5);
  expect((await ended).result.rank).toEqual({ position: 1, outOf: 1, provisional: true });
  const again = await connect(srv.url, team.alice.token);
  const snap = nextEvent(again, 'attempt:snapshot');
  await again.emitWithAck('attempt:join', { attemptId: team.attemptId });
  expect((await snap).result.rank).toEqual({ position: 1, outOf: 1, provisional: true });
});

test('practice results have rank null', async () => {
  const room = await startedRoom({ leaderboardDelayMs: 50 });
  srvs.push(room.srv);
  const ended = nextEvent(room.a, 'attempt:ended');
  const answers = ['9742', 'FIREWALL', '23-12-4', '8315', 'NODE'];
  for (let i = 0; i < 5; i += 1) expect(await submit(i % 2 ? room.b : room.a, i + 1, answers[i])).toEqual({ ok: true });
  expect((await ended).result.rank).toBeNull();
});

test('leaderboard:watch refuses guests and unknown challenges', async () => {
  await server();
  const guest = await createGuest(srv.app);
  const g = await connect(srv.url, guest.token);
  expect((await ask(g, 'leaderboard:watch', { challengeId: '6af5fc0d9bf80474ac591cf8' })).error).toBe('GUEST_NOT_ALLOWED');
  const player = await createPlayer(srv.app, 'viewer');
  const p = await connect(srv.url, player.token);
  expect((await ask(p, 'leaderboard:watch', { challengeId: '6af5fc0d9bf80474ac591cf8' })).error).toBe('CHALLENGE_NOT_FOUND');
  expect((await ask(p, 'leaderboard:watch', {})).error).toBe('VALIDATION_ERROR');
});

test('joining a practice room still works with the hub attached', async () => {
  const room = await startedRoom();
  srvs.push(room.srv);
  const again = await connect(room.srv.url, room.alice.token);
  expect(await join(again, room.code)).toEqual({ ok: true });
});
