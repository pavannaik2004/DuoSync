const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Team = require('../src/models/Team');
const Attempt = require('../src/models/Attempt');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { challengeDoc, entryDoc, startedAttemptDoc } = require('./helpers/attempts');
const { createPlayer, createGuest } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });

beforeAll(startDb);
afterEach(clearDb);
afterAll(stopDb);

const get = (path, auth) => request(app).get(`/api${path}`).set('Authorization', auth);
const oid = (id) => new mongoose.Types.ObjectId(id);
const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 12));
const done = (points, n, over = {}) => ({
  status: 'finished', totalPoints: points, levelsCleared: 5, timeUsedMs: 600000, finishedAt: day(n), stars: 1, ...over,
});

let alice;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
});

/** Alice plays `count` challenges with team "Alice Crew", one per day, points 100 + 10·i. */
async function aliceHistory(count) {
  const partner = new mongoose.Types.ObjectId();
  const members = [oid(alice.user.id), partner];
  const team = await Team.create({ name: 'Alice Crew', captainId: members[0], memberIds: members });
  const attempts = [];
  for (let i = 0; i < count; i += 1) {
    const c = await challengeDoc({ name: `Night ${i}` });
    attempts.push(await Attempt.create({
      challengeId: c._id, teamId: team._id, memberIds: members, themeSlug: c.themeSlug, theme: c.theme,
      players: members.map((id, k) => ({ id: String(id), kind: 'user', name: k ? 'partner' : 'alice' })), ...done(100 + 10 * i, i),
    }));
  }
  return { team, attempts };
}

test('SCORE-7: history is 10 per page, newest first, final challenge attempts only', async () => {
  const { team } = await aliceHistory(12);
  await startedAttemptDoc({ status: 'finished', finishedAt: day(40), practiceCode: 'PRAC22', players: [{ id: alice.user.id, kind: 'user', name: 'alice' }] });
  const live = await challengeDoc({ name: 'Live Now' });
  await entryDoc(live, 'Other Crew', { status: 'in_progress' }, { memberIds: [oid(alice.user.id), new mongoose.Types.ObjectId()] });

  const p1 = await get('/users/me/history', alice.auth);
  expect(p1.status).toBe(200);
  expect(p1.body).toMatchObject({ page: 1, pageSize: 10, total: 12, pages: 2 });
  expect(p1.body.items).toHaveLength(10);
  expect(p1.body.items[0]).toEqual({
    attemptId: expect.any(String),
    challenge: { code: expect.any(String), name: 'Night 11' },
    theme: { name: expect.stringContaining('Cyber Heist') },
    team: { id: String(team._id), name: 'Alice Crew' },
    points: 210,
    levelsCleared: 5,
    stars: 1,
    status: 'finished',
    rank: { position: 1, outOf: 1, provisional: true },
    finishedAt: day(11).toISOString(),
  });
  expect(p1.body.items[0].finishedAt > p1.body.items[1].finishedAt).toBe(true);
  const p2 = await get('/users/me/history?page=2', alice.auth);
  expect(p2.body.items.map((i) => i.challenge.name)).toEqual(['Night 1', 'Night 0']);
  expect(JSON.stringify(p1.body)).not.toContain('"answer"');
});

test('a page past the end is empty; page=0 or page=x is 400', async () => {
  await aliceHistory(2);
  const far = await get('/users/me/history?page=9', alice.auth);
  expect(far.status).toBe(200);
  expect(far.body).toMatchObject({ items: [], page: 9, total: 2, pages: 1 });
  expect((await get('/users/me/history?page=0', alice.auth)).body.error).toBe('VALIDATION_ERROR');
  expect((await get('/users/me/history?page=x', alice.auth)).status).toBe(400);
});

test('AUTH-6: the profile shows teams, challenges played, total points and best rank', async () => {
  const { team } = await aliceHistory(3); // 100 + 110 + 120
  const shared = await challengeDoc({ name: 'Crowded' });
  await entryDoc(shared, 'Top Dogs', done(500, 20));
  await entryDoc(shared, 'Alice Solo', done(50, 21), { memberIds: [oid(alice.user.id), new mongoose.Types.ObjectId()] });
  const res = await get('/users/me', alice.auth);
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    id: alice.user.id,
    username: 'alice',
    avatarColor: expect.any(String),
    joinedAt: expect.any(String),
    challengesPlayed: 4,
    totalPoints: 380,
    bestRank: 1,
  });
  expect(res.body.teams).toEqual(expect.arrayContaining([{ id: String(team._id), name: 'Alice Crew', archived: false }]));
  expect(res.body.teams.map((t) => t.name).sort()).toEqual(['Alice Crew', 'Alice Solo']);
});

test('AUTH-6: a new player has an empty profile', async () => {
  const res = await get('/users/me', alice.auth);
  expect(res.body).toMatchObject({ challengesPlayed: 0, totalPoints: 0, bestRank: null, teams: [] });
});

test('TEAM-6: team history lists that team only, and survives the team being archived', async () => {
  const { team } = await aliceHistory(2);
  const c = await challengeDoc();
  await entryDoc(c, 'Other Crew', done(300, 30));
  await Team.updateOne({ _id: team._id }, { archived: true, memberIds: [] });
  const bob = await createPlayer(app, 'bob');
  const res = await get(`/teams/${team._id}/history`, bob.auth);
  expect(res.status).toBe(200);
  expect(res.body.items.map((i) => i.team.name)).toEqual(['Alice Crew', 'Alice Crew']);
  expect((await get(`/teams/${new mongoose.Types.ObjectId()}/history`, bob.auth)).body.error).toBe('TEAM_NOT_FOUND');
  expect((await get(`/teams/${team._id}/history?page=-1`, bob.auth)).status).toBe(400);
});

test('TEAM-3: my teams carry a record of played and total points', async () => {
  await aliceHistory(2);
  const res = await get('/teams/mine', alice.auth);
  expect(res.body.teams[0]).toMatchObject({ name: 'Alice Crew', record: { played: 2, totalPoints: 210 } });
});

test('TEAM-3: a team with no games has a zero record', async () => {
  await request(app).post('/api/teams').set('Authorization', alice.auth).send({ name: 'Fresh Team' });
  const res = await get('/teams/mine', alice.auth);
  expect(res.body.teams[0].record).toEqual({ played: 0, totalPoints: 0 });
});

test('guests get 403 on /users/me and its history', async () => {
  const guest = await createGuest(app);
  expect((await get('/users/me', guest.auth)).body.error).toBe('GUEST_NOT_ALLOWED');
  expect((await get('/users/me/history', guest.auth)).status).toBe(403);
});
