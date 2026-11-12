const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const Attempt = require('../src/models/Attempt');
const lobby = require('../src/services/lobbyService');
const teamService = require('../src/services/teamService');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer } = require('./helpers/users');
const { createOpenChallenge, enterTeam } = require('./helpers/rooms');

const app = createApp({ authRateLimit: 1000 });
const versionError = () => new mongoose.Error.VersionError({ _doc: { _id: 1 } }, 0, []);

beforeAll(startDb);
beforeEach(seedThemes);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(stopDb);

test('a partner pulled from the entry between load and save does not corrupt the lobby write', async () => {
  const owner = await createPlayer(app, 'owner');
  const challenge = await createOpenChallenge(app, owner.auth);
  const { p1: alice, p2: bob, team, attemptId } = await enterTeam(app, challenge.id, ['alice', 'bob']);
  await Attempt.updateOne({ _id: attemptId }, { status: 'lobby' });

  // alice leaves the team after claimRole has loaded the attempt but before it saves.
  const real = Attempt.findById.bind(Attempt);
  jest.spyOn(Attempt, 'findById').mockImplementationOnce(async (...args) => {
    const doc = await real(...args);
    await teamService.removeMember(team.id, alice.user.id, alice.user.id);
    return doc;
  });

  await lobby.claimRole(attemptId, bob.user.id, 'B');

  const after = await Attempt.findById(attemptId);
  expect(after.players).toHaveLength(1);
  expect(after.players[0]).toMatchObject({ id: bob.user.id, role: 'B' });
});

test('a VersionError on every try surfaces after 3 attempts', async () => {
  const fn = jest.fn().mockRejectedValue(versionError());
  await expect(lobby.withVersionRetry(fn)).rejects.toBeInstanceOf(mongoose.Error.VersionError);
  expect(fn).toHaveBeenCalledTimes(3);
});

test('withVersionRetry returns the first successful try', async () => {
  const fn = jest.fn()
    .mockRejectedValueOnce(versionError())
    .mockResolvedValueOnce('done');
  await expect(lobby.withVersionRetry(fn)).resolves.toBe('done');
  expect(fn).toHaveBeenCalledTimes(2);
});

test('flow.logFailure logs background job failures with a label instead of swallowing them', () => {
  const { logFailure } = require('../src/sockets/flow');
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const err = new Error('boom');
  logFailure('tick')(err);
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('tick'), err);
});
