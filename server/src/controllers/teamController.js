const teamService = require('../services/teamService');
const { history } = require('../services/historyService');

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

async function removeMember(req, res) {
  await teamService.removeMember(req.params.id, req.user._id, req.params.userId);
  res.status(204).end();
}

/** TEAM-6: any player may read a team's history, archived teams included (D12). */
async function teamHistory(req, res) {
  await teamService.findTeam(req.params.id); // 404 TEAM_NOT_FOUND
  res.json(await history({ teamId: req.params.id }, Number(req.query.page) || 1));
}

module.exports = {
  create, mine, show, join, rename, newInviteCode, removeMember, teamHistory,
};
