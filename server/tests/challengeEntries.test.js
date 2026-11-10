const request = require('supertest');
const { createApp } = require('../src/app');
const Challenge = require('../src/models/Challenge');
const Attempt = require('../src/models/Attempt');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer } = require('./helpers/users');

const app = createApp({ authRateLimit: 1000 });
const HOUR = 60 * 60e3;

beforeAll(startDb);
beforeEach(seedThemes);
afterEach(clearDb);
afterAll(stopDb);

const mkTeam = async (owner, name, partner) => {
  const team = (await request(app).post('/api/teams').set('Authorization', owner.auth).send({ name })).body;
  if (partner) await request(app).post('/api/teams/join').set('Authorization', partner.auth).send({ code: team.inviteCode });
  return team;
};
const enter = (auth, challengeId, teamId) =>
  request(app).post(`/api/challenges/${challengeId}/entries`).set('Authorization', auth).send({ teamId });

/** Creates a challenge as `creator` and moves its window so it is open now. */
async function openChallenge(creator, over = {}) {
  const now = Date.now();
  const res = await request(app).post('/api/challenges').set('Authorization', creator.auth).send({
    name: 'Friday Heist', theme: 'cyber-heist', visibility: 'private',
    startsAt: new Date(now + HOUR).toISOString(), endsAt: new Date(now + 3 * HOUR).toISOString(),
  });
  await Challenge.updateOne({ code: res.body.code }, { startsAt: new Date(now - HOUR), ...over });
  return { id: res.body.id, code: res.body.code };
}

let alice;
let bob;
let carol;
beforeEach(async () => {
  alice = await createPlayer(app, 'alice');
  bob = await createPlayer(app, 'bob');
  carol = await createPlayer(app, 'carol');
});

test('a member enters with a full team: 201, attempt status entered with both players', async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const ch = await openChallenge(alice);
  const res = await enter(alice.auth, ch.id, team.id);
  expect(res.status).toBe(201);
  const attempt = await Attempt.findById(res.body.attemptId);
  expect(attempt.status).toBe('entered');
  expect(attempt.players.map((p) => p.name).sort()).toEqual(['alice', 'bob']);
  expect(attempt.memberIds).toHaveLength(2);
  expect(attempt.theme.slug).toBe('cyber-heist');
  const page = await request(app).get(`/api/challenges/${ch.code}`).set('Authorization', bob.auth);
  expect(page.body.myEntry).toMatchObject({ attemptId: res.body.attemptId, status: 'entered' });
});

test('the same team entering twice → 409 ALREADY_ENTERED', async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const ch = await openChallenge(alice);
  await enter(alice.auth, ch.id, team.id);
  const res = await enter(bob.auth, ch.id, team.id);
  expect(res.status).toBe(409);
  expect(res.body.error).toBe('ALREADY_ENTERED');
});

test('Review Focus 1: a player in two teams entering both at once → one 201, one 409 MEMBER_IN_CHALLENGE', async () => {
  const teamAB = await mkTeam(alice, 'Night Owls', bob);
  const teamAC = await mkTeam(alice, 'Day Owls', carol);
  const ch = await openChallenge(alice);
  const [r1, r2] = await Promise.all([enter(alice.auth, ch.id, teamAB.id), enter(alice.auth, ch.id, teamAC.id)]);
  expect([r1.status, r2.status].sort()).toEqual([201, 409]);
  expect([r1, r2].find((r) => r.status === 409).body.error).toBe('MEMBER_IN_CHALLENGE');
  expect(await Attempt.countDocuments({ challengeId: ch.id })).toBe(1);
});

test('a team of 1 → 409 TEAM_NOT_FULL', async () => {
  const team = await mkTeam(alice, 'Night Owls');
  const ch = await openChallenge(alice);
  const res = await enter(alice.auth, ch.id, team.id);
  expect([res.status, res.body.error]).toEqual([409, 'TEAM_NOT_FULL']);
});

test("someone else's team → 403 NOT_TEAM_MEMBER", async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const ch = await openChallenge(alice);
  const res = await enter(carol.auth, ch.id, team.id);
  expect([res.status, res.body.error]).toEqual([403, 'NOT_TEAM_MEMBER']);
});

test('after endsAt → 409 CHALLENGE_CLOSED', async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const ch = await openChallenge(alice, { endsAt: new Date(Date.now() - 1000) });
  const res = await enter(alice.auth, ch.id, team.id);
  expect([res.status, res.body.error]).toEqual([409, 'CHALLENGE_CLOSED']);
});

test('maxTeams reached → 409 CHALLENGE_FULL', async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const dave = await createPlayer(app, 'dave');
  const erin = await createPlayer(app, 'erin');
  const other = await mkTeam(dave, 'Other', erin);
  const ch = await openChallenge(alice, { maxTeams: 1 });
  expect((await enter(dave.auth, ch.id, other.id)).status).toBe(201);
  const res = await enter(alice.auth, ch.id, team.id);
  expect([res.status, res.body.error]).toEqual([409, 'CHALLENGE_FULL']);
});

test('an unknown challenge → 404 CHALLENGE_NOT_FOUND', async () => {
  const team = await mkTeam(alice, 'Night Owls', bob);
  const res = await enter(alice.auth, '64b000000000000000000000', team.id);
  expect([res.status, res.body.error]).toEqual([404, 'CHALLENGE_NOT_FOUND']);
});
