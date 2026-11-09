const mongoose = require('mongoose');
const Team = require('../models/Team');
const AppError = require('../utils/AppError');
const { generateCode } = require('./codeService');

const INVITE_LENGTH = 8; // TEAM-1
const MEMBER_FIELDS = 'username avatarColor';

const notFound = () => new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
const nameTaken = () => new AppError(409, 'TEAM_NAME_TAKEN', 'That team name is taken');

/**
 * The team as the API returns it. Expects memberIds populated with
 * username and avatarColor. Only members see the invite code (DECISIONS D12).
 */
function toView(team, viewerId) {
  const viewer = String(viewerId);
  const members = team.memberIds.map((m) => ({ id: String(m._id), username: m.username, avatarColor: m.avatarColor }));
  const view = {
    id: String(team._id),
    name: team.name,
    captainId: String(team.captainId),
    members,
    archived: team.archived,
    createdAt: team.createdAt,
    isCaptain: String(team.captainId) === viewer,
  };
  if (members.some((m) => m.id === viewer) && team.inviteCode) view.inviteCode = team.inviteCode;
  return view;
}

async function findTeam(teamId) {
  if (!mongoose.isValidObjectId(teamId)) throw notFound();
  const team = await Team.findById(teamId).populate('memberIds', MEMBER_FIELDS);
  if (!team) throw notFound();
  return team;
}

async function assertNameFree(name, exceptTeamId) {
  const existing = await Team.findOne({ name }).collation(Team.CASE_INSENSITIVE);
  if (existing && String(existing._id) !== String(exceptTeamId)) throw nameTaken();
}

/** Retries on the (unlikely) invite-code collision; maps a name collision to 409. */
async function withFreshCode(save) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await save(generateCode(INVITE_LENGTH));
    } catch (err) {
      if (err.code !== 11000) throw err;
      if (!(err.keyPattern && err.keyPattern.inviteCode)) throw nameTaken();
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not generate an invite code');
}

async function createTeam(userId, name) {
  await assertNameFree(name);
  const team = await withFreshCode((inviteCode) =>
    Team.create({ name, captainId: userId, memberIds: [userId], inviteCode }));
  await team.populate('memberIds', MEMBER_FIELDS);
  return toView(team, userId);
}

async function listMine(userId) {
  const teams = await Team.find({ memberIds: userId, archived: false })
    .sort({ createdAt: -1 })
    .populate('memberIds', MEMBER_FIELDS);
  return teams.map((t) => toView(t, userId));
}

async function getTeam(teamId, viewerId) {
  return toView(await findTeam(teamId), viewerId);
}

module.exports = { toView, createTeam, listMine, getTeam };
