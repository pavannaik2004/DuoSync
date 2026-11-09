const teamService = require('../services/teamService');

async function create(req, res) {
  res.status(201).json(await teamService.createTeam(req.user._id, req.body.name));
}

async function mine(req, res) {
  res.json({ teams: await teamService.listMine(req.user._id) });
}

async function show(req, res) {
  res.json(await teamService.getTeam(req.params.id, req.user._id));
}

async function join(req, res) {
  res.json(await teamService.joinTeam(req.user._id, req.body.code));
}

async function rename(req, res) {
  res.json(await teamService.renameTeam(req.params.id, req.user._id, req.body.name));
}

async function newInviteCode(req, res) {
  res.json(await teamService.regenerateInvite(req.params.id, req.user._id));
}

module.exports = { create, mine, show, join, rename, newInviteCode };
