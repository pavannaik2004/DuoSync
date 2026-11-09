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

module.exports = { create, mine, show };
