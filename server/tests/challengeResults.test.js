const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Message = require('../src/models/Message');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const {
  challengeDoc, entryDoc, startedAttemptDoc, HOUR,
} = require('./helpers/attempts');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const get = (path, auth) => request(app).get(`/api${path}`).set('Authorization', auth);
const closedWindow = () => ({ startsAt: new Date(Date.now() - 3 * HOUR), endsAt: new Date(Date.now() - HOUR) });
const done = (points, levels) => ({ status: 'finished', totalPoints: points, levelsCleared: levels, timeUsedMs: 600000, finishedAt: new Date(), stars: 1 });

let creator;
beforeEach(async () => {
  creator = await createPlayer(app, 'creator');
});

async function fourTeams(over = {}) {
  const c = await challengeDoc({ creatorId: creator.user.id, ...over });
  await entryDoc(c, 'Winners', done(480, 5));
  await entryDoc(c, 'Runners', { status: 'paused', levelsCleared: 2, totalPoints: 180 });
  await entryDoc(c, 'Quitters', { ...done(90, 1), status: 'ended_early' });
  await entryDoc(c, 'Sleepers', { status: 'entered' });
  return c;
}

test('SCORE-5: the creator sees every team status, level reached and points', async () => {
  const c = await fourTeams();
  const res = await get(`/challenges/${c._id}/teams`, creator.auth);
  expect(res.status).toBe(200);
  const byName = Object.fromEntries(res.body.teams.map((t) => [t.teamName, t]));
  expect(byName.Winners).toMatchObject({ status: 'finished', levelReached: 5, points: 480, members: ['Winners0', 'Winners1'] });
  expect(byName.Runners).toMatchObject({ status: 'paused', levelReached: 3, points: 180 });
  expect(byName.Quitters).toMatchObject({ status: 'ended_early', levelReached: 1, points: 90 });
  expect(byName.Sleepers).toMatchObject({ status: 'not_started', levelReached: 0, points: 0 });
  expect(Object.keys(byName.Winners).sort()).toEqual(['levelReached', 'members', 'points', 'status', 'teamId', 'teamName']);
});

test('SCORE-5: once the window closes, teams that never started did not start', async () => {
  const c = await fourTeams(closedWindow());
  const res = await get(`/challenges/${c._id}/teams`, creator.auth);
  expect(res.body.teams.find((t) => t.teamName === 'Sleepers').status).toBe('did_not_start');
});

test('SCORE-5: an organizer and an admin may look; a plain player gets 403', async () => {
  const c = await fourTeams();
  const org = await createPlayer(app, 'organizer');
  await User.updateOne({ _id: org.user.id }, { roles: ['player', 'organizer'] });
  expect((await get(`/challenges/${c._id}/teams`, org.auth)).status).toBe(200);
  const admin = await createPlayer(app, 'admin');
  await User.updateOne({ _id: admin.user.id }, { roles: ['player', 'admin'] });
  expect((await get(`/challenges/${c._id}/teams`, admin.auth)).status).toBe(200);
  const someone = await createPlayer(app, 'someone');
  const res = await get(`/challenges/${c._id}/teams`, someone.auth);
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('NOT_CREATOR');
});

test('Q3: a creator who also plays may open the team view; the challenge page says so', async () => {
  const c = await challengeDoc({ creatorId: creator.user.id });
  await entryDoc(c, 'Creators', { status: 'in_progress' }, { memberIds: [new mongoose.Types.ObjectId(creator.user.id), new mongoose.Types.ObjectId()] });
  expect((await get(`/challenges/${c._id}/teams`, creator.auth)).status).toBe(200);
  expect((await get(`/challenges/${c.code}`, creator.auth)).body.canSeeTeams).toBe(true);
  const someone = await createPlayer(app, 'someone');
  expect((await get(`/challenges/${c.code}`, someone.auth)).body.canSeeTeams).toBe(false);
});

test('CHAL-10: solutions are 409 NOT_CLOSED while open and while an attempt still runs after endsAt', async () => {
  const open = await challengeDoc();
  const res = await get(`/challenges/${open._id}/solutions`, creator.auth);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('NOT_CLOSED');
  const closing = await challengeDoc(closedWindow());
  await entryDoc(closing, 'Late Runner', { status: 'in_progress' });
  expect((await get(`/challenges/${closing._id}/solutions`, creator.auth)).body.error).toBe('NOT_CLOSED');
});

test('CHAL-10: once closed, solutions list every level answer and explanation', async () => {
  const c = await challengeDoc(closedWindow());
  await entryDoc(c, 'Done Team', done(300, 3));
  const res = await get(`/challenges/${c._id}/solutions`, creator.auth);
  expect(res.status).toBe(200);
  expect(res.body.levels).toHaveLength(5);
  expect(res.body.levels[0]).toEqual({
    order: 1, title: c.levels[0].title, answer: c.levels[0].answer, explanation: c.levels[0].explanation,
  });
});

test('solutions and the team view refuse guests and unknown challenges', async () => {
  const guest = await createGuest(app);
  const c = await challengeDoc(closedWindow());
  expect((await get(`/challenges/${c._id}/solutions`, guest.auth)).status).toBe(403);
  expect((await get(`/challenges/${new mongoose.Types.ObjectId()}/solutions`, creator.auth)).status).toBe(404);
  expect((await get(`/challenges/${new mongoose.Types.ObjectId()}/teams`, creator.auth)).status).toBe(404);
});

test('GET /attempts/:id/result: members get result, rank and chat; others 403; a running attempt 409', async () => {
  const alice = await createPlayer(app, 'alice');
  const c = await challengeDoc();
  const { attempt } = await entryDoc(c, 'Alice Team', done(400, 5), { memberIds: [new mongoose.Types.ObjectId(alice.user.id), new mongoose.Types.ObjectId()] });
  await Message.create({ attemptId: attempt._id, kind: 'user', senderName: 'alice', role: 'A', text: 'we did it' });
  const res = await get(`/attempts/${attempt._id}/result`, alice.auth);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    attemptId: String(attempt._id),
    challenge: { id: String(c._id), code: c.code, name: c.name },
    theme: { name: c.theme.name, roles: expect.any(Object) },
    result: { status: 'finished', rank: { position: 1, outOf: 1, provisional: true } },
  });
  expect(res.body.chat.map((m) => m.text)).toEqual(['we did it']);
  expect(JSON.stringify(res.body)).not.toContain('"answer"');

  const bob = await createPlayer(app, 'bob');
  expect((await get(`/attempts/${attempt._id}/result`, bob.auth)).body.error).toBe('NOT_IN_ATTEMPT');
  expect((await get(`/attempts/${new mongoose.Types.ObjectId()}/result`, alice.auth)).body.error).toBe('ATTEMPT_NOT_FOUND');
  expect((await get('/attempts/nonsense/result', alice.auth)).status).toBe(404);
});

test('a running attempt result is 409 NOT_FINISHED', async () => {
  const alice = await createPlayer(app, 'alice');
  const c = await challengeDoc();
  const { attempt } = await entryDoc(c, 'Alice Team', { status: 'in_progress' }, { memberIds: [new mongoose.Types.ObjectId(alice.user.id), new mongoose.Types.ObjectId()] });
  const res = await get(`/attempts/${attempt._id}/result`, alice.auth);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('NOT_FINISHED');
});

test('a practice guest can read their own practice result, with rank null', async () => {
  const guest = await createGuest(app);
  const attempt = await startedAttemptDoc({
    status: 'ended_early', finishedAt: new Date(), practiceCode: 'PRAC22',
    players: [{ id: guest.guest.id, kind: 'guest', name: 'Visitor_9', role: 'A' }, { id: 'guest_x', kind: 'guest', name: 'Other', role: 'B' }],
  });
  const res = await get(`/attempts/${attempt._id}/result`, guest.auth);
  expect(res.status).toBe(200);
  expect(res.body.challenge).toBeNull();
  expect(res.body.result.rank).toBeNull();
});
