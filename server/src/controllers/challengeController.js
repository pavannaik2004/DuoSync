const challengeService = require('../services/challengeService');
const { leaderboardFor } = require('../services/leaderboardService');

async function list(req, res) {
  const { status, theme, page } = req.query;
  // Express 5's req.query is read-only, so express-validator's toInt() cannot convert it here.
  res.json(await challengeService.listPublic({ status, theme, page: page === undefined ? 1 : Number(page) }, Date.now()));
}

async function create(req, res) {
  res.status(201).json(await challengeService.createChallenge(req.user, req.body, Date.now()));
}

async function show(req, res) {
  res.json(await challengeService.getChallengeByCode(req.params.code, req.user, Date.now()));
}

async function update(req, res) {
  await challengeService.updateChallenge(req.params.id, req.user, req.body, Date.now());
  res.status(204).end();
}

async function remove(req, res) {
  await challengeService.deleteChallenge(req.params.id, req.user);
  res.status(204).end();
}

async function enter(req, res) {
  res.status(201).json(await challengeService.enterChallenge(req.params.id, req.user, req.body, Date.now()));
}

async function teams(req, res) {
  res.json(await challengeService.teamStatuses(req.params.id, req.user, Date.now()));
}

async function solutions(req, res) {
  res.json(await challengeService.solutions(req.params.id, Date.now()));
}

async function leaderboard(req, res) {
  res.json(await leaderboardFor(req.params.id, Date.now()));
}

module.exports = {
  list, enter, create, show, update, remove, leaderboard, teams, solutions,
};
