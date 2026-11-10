const challengeService = require('../services/challengeService');

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

module.exports = { enter, create, show, update, remove };
