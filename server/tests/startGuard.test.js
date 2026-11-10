const mongoose = require('mongoose');
const Attempt = require('../src/models/Attempt');
const { startAttempt } = require('../src/services/lobbyService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createApp } = require('../src/app');
const { createPlayer } = require('./helpers/users');

beforeAll(startDb);
beforeEach(seedThemes);
afterEach(clearDb);
afterAll(stopDb);

const player = (name, role, ready = true) => ({ id: new mongoose.Types.ObjectId().toString(), kind: 'user', name, role, ready });
const mk = (status, players) => Attempt.create({
  themeSlug: 'cyber-heist', status, players, countdownEndsAt: new Date(), practiceCode: 'ABC234',
});
const start = (id) => startAttempt(id, { now: Date.now(), levelSetFor: () => { throw new Error('should not build levels'); } });

test('a countdown with one player returns null and resets to the lobby, nobody ready', async () => {
  const attempt = await mk('countdown', [player('alice', 'A')]);
  expect(await start(attempt._id)).toBeNull();
  const saved = await Attempt.findById(attempt._id);
  expect(saved.status).toBe('lobby');
  expect(saved.countdownEndsAt).toBeNull();
  expect(saved.players.every((p) => p.ready === false)).toBe(true);
});

test('two players without roles A and B also reset to the lobby', async () => {
  const attempt = await mk('countdown', [player('alice', 'A'), player('bob', 'A')]);
  expect(await start(attempt._id)).toBeNull();
  expect((await Attempt.findById(attempt._id)).status).toBe('lobby');
});

test('a partner removed from a lobby with both ready: the rest is unready and cannot start', async () => {
  const { removeMember } = require('../src/services/teamService');
  const Team = require('../src/models/Team');
  const app = createApp({ authRateLimit: 1000 });
  const a = new mongoose.Types.ObjectId((await createPlayer(app, 'alice')).user.id);
  const b = new mongoose.Types.ObjectId((await createPlayer(app, 'bob')).user.id);
  const team = await Team.create({ name: 'Night Owls', captainId: a, memberIds: [a, b], inviteCode: 'ABCD2345' });
  const attempt = await Attempt.create({
    themeSlug: 'cyber-heist', status: 'lobby', teamId: team._id, memberIds: [a, b],
    players: [{ ...player('alice', 'A'), id: String(a) }, { ...player('bob', 'B'), id: String(b) }],
  });
  await removeMember(team._id, a, b);
  const saved = await Attempt.findById(attempt._id);
  expect(saved.players.map((p) => [p.name, p.ready])).toEqual([['alice', false]]);
  await Attempt.updateOne({ _id: attempt._id }, { status: 'countdown' });
  expect(await start(attempt._id)).toBeNull();
  expect((await Attempt.findById(attempt._id)).status).toBe('lobby');
});
