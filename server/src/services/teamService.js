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

function assertCaptain(team, userId) {
  if (String(team.captainId) !== String(userId)) {
    throw new AppError(403, 'NOT_CAPTAIN', 'Only the team captain can do that');
  }
}

/**
 * Joins with an invite code in one atomic update, so two players racing for
 * the last slot can never make a team of 3 (DECISIONS D13).
 */
async function joinTeam(userId, code) {
  const inviteCode = code.trim().toUpperCase();
  const team = await Team.findOneAndUpdate(
    { inviteCode, archived: false, memberIds: { $ne: userId }, 'memberIds.1': { $exists: false } },
    { $push: { memberIds: userId } },
    { returnDocument: 'after' },
  ).populate('memberIds', MEMBER_FIELDS);
  if (team) return toView(team, userId);

  // Work out why it failed.
  const existing = await Team.findOne({ inviteCode, archived: false });
  if (!existing) throw new AppError(404, 'INVALID_INVITE_CODE', 'That invite code does not work');
  if (existing.memberIds.some((id) => String(id) === String(userId))) {
    throw new AppError(409, 'ALREADY_MEMBER', 'You are already in this team');
  }
  throw new AppError(409, 'TEAM_FULL', 'This team already has 2 members');
}

async function renameTeam(teamId, userId, name) {
  const team = await findTeam(teamId);
  assertCaptain(team, userId);
  await assertNameFree(name, team._id);
  team.name = name;
  try {
    await team.save();
  } catch (err) {
    if (err.code === 11000) throw nameTaken();
    throw err;
  }
  return toView(team, userId);
}

/** TEAM-4: a new code replaces the old one, which stops working at once. */
async function regenerateInvite(teamId, userId) {
  const team = await findTeam(teamId);
  assertCaptain(team, userId);
  if (team.archived) throw notFound();
  const updated = await withFreshCode((inviteCode) =>
    Team.findByIdAndUpdate(team._id, { inviteCode }, { returnDocument: 'after' }));
  return { inviteCode: updated.inviteCode };
}

/**
 * The captain removes the partner, or a member leaves (TEAM-4, TEAM-5).
 * Captain leaving with a partner left → the partner becomes captain (DECISIONS D10).
 * Last member leaving → archived, invite code removed, past results kept.
 */
async function removeMember(teamId, actorId, targetUserId) {
  const team = await findTeam(teamId);
  const actor = String(actorId);
  const target = String(targetUserId);
  const isSelf = actor === target;

  if (!isSelf) assertCaptain(team, actor);
  const memberIds = team.memberIds.map((m) => String(m._id));
  if (!memberIds.includes(target)) throw new AppError(404, 'MEMBER_NOT_FOUND', 'That player is not in this team');
  // TEAM-7: block while an attempt is in progress (Phase 3).

  const remaining = memberIds.filter((id) => id !== target);
  const update = remaining.length === 0
    ? { $set: { memberIds: [], archived: true }, $unset: { inviteCode: 1 } }
    : { $set: { memberIds: remaining, captainId: String(team.captainId) === target ? remaining[0] : team.captainId } };

  // Only apply if membership is unchanged since we read it (optimistic check).
  const result = await Team.updateOne({ _id: team._id, memberIds: { $size: memberIds.length, $all: memberIds } }, update);
  if (result.modifiedCount !== 1) {
    throw new AppError(409, 'TEAM_CHANGED', 'The team changed while you were doing that. Try again.');
  }
}

module.exports = {
  toView, createTeam, listMine, getTeam, joinTeam, renameTeam, regenerateInvite, removeMember,
};
