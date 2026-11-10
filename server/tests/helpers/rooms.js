const request = require('supertest');
const Challenge = require('../../src/models/Challenge');
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

const HOUR = 60 * 60e3;

/** Creates a challenge through the API and moves its window: open from an hour ago until `endsInMs` from now. */
async function createOpenChallenge(app, creatorAuth, { theme = 'cyber-heist', endsInMs = 2 * HOUR, startsInMs = -HOUR } = {}) {
  const now = Date.now();
  const res = await request(app).post('/api/challenges').set('Authorization', creatorAuth).send({
    name: 'Friday Heist', theme, visibility: 'private',
    startsAt: new Date(now + HOUR).toISOString(), endsAt: new Date(now + 3 * HOUR).toISOString(),
  });
  if (res.status !== 201) throw new Error(`createChallenge failed: ${res.status} ${JSON.stringify(res.body)}`);
  await Challenge.updateOne({ code: res.body.code }, { startsAt: new Date(now + startsInMs), endsAt: new Date(now + endsInMs) });
  return { id: res.body.id, code: res.body.code };
}

/** Signs up two players, forms a team and enters it into the challenge; returns the attempt id. */
async function enterTeam(app, challengeId, names) {
  const [p1, p2] = [await createPlayer(app, names[0]), await createPlayer(app, names[1])];
  const team = (await request(app).post('/api/teams').set('Authorization', p1.auth).send({ name: `${names[0]} and ${names[1]}` })).body;
  await request(app).post('/api/teams/join').set('Authorization', p2.auth).send({ code: team.inviteCode });
  const res = await request(app).post(`/api/challenges/${challengeId}/entries`).set('Authorization', p1.auth).send({ teamId: team.id });
  if (res.status !== 201) throw new Error(`enter failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { p1, p2, team, attemptId: res.body.attemptId };
}

/**
 * Like startedRoom, for a challenge attempt joined by attemptId. Options: srv and challenge
 * (to put a second team in the same challenge), names (default alice, bob), endsInMs,
 * and ready: false to stop in the lobby. Everything else goes to the socket server.
 */
async function startedChallengeAttempt({ srv: given, challenge: givenChallenge, names = ['alice', 'bob'], endsInMs, ready = true, ...options } = {}) {
  const srv = given || await startSocketServer({ countdownMs: 50, tickMs: 100, submitGapMs: 0, ...options });
  let challenge = givenChallenge;
  if (!challenge) { // a separate owner creates the challenge, so both team members stay plain entrants
    const creator = await createPlayer(srv.app, `${names[0]}Owner`);
    challenge = await createOpenChallenge(srv.app, creator.auth, { endsInMs });
  }
  const team = await enterTeam(srv.app, challenge.id, names);
  const { p1: alice, p2: bob, attemptId } = team;
  const a = await connect(srv.url, alice.token);
  const b = await connect(srv.url, bob.token);
  const joined = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await a.emitWithAck('attempt:join', { attemptId });
  await b.emitWithAck('attempt:join', { attemptId });
  await joined;
  const base = { srv, a, b, alice, bob, challenge, attemptId };
  if (!ready) return base;
  await a.emitWithAck('lobby:claimRole', { role: 'A' });
  await b.emitWithAck('lobby:claimRole', { role: 'B' });
  const started = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await a.emitWithAck('lobby:ready');
  await b.emitWithAck('lobby:ready');
  const [snapA, snapB] = await started;
  return { ...base, snapA, snapB };
}

/** emitWithAck that fails after 3 s instead of hanging when nothing answers. */
const ask = (socket, event, payload) => socket.timeout(3000).emitWithAck(event, payload);
const submit = (socket, order, answer) => ask(socket, 'level:submit', { order, answer });

module.exports = { startedRoom, startedChallengeAttempt, createOpenChallenge, enterTeam, ask, submit };
