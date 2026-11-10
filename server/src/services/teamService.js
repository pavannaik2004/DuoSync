const mongoose = require('mongoose');
const Team = require('../models/Team');
const Attempt = require('../models/Attempt');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { generateCode } = require('./codeService');

const INVITE_LENGTH = 8; // TEAM-1
const MEMBER_FIELDS = 'username avatarColor';

const NOT_STARTED = ['entered', 'lobby'];
const RUNNING = ['countdown', 'in_progress', 'paused'];

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
const partnerInChallenge = () =>
  new AppError(409, 'PARTNER_IN_CHALLENGE', 'You are already in that challenge with another team');

/** CHAL-6 pre-check: the new partner must not already be in a challenge this team entered. */
async function assertPartnerFree(teamId, userId) {
  const entries = await Attempt.find({ teamId, status: { $in: NOT_STARTED } }, { challengeId: 1 });
  if (entries.length === 0) return;
  const clash = await Attempt.exists({ challengeId: { $in: entries.map((e) => e.challengeId) }, memberIds: userId });
  if (clash) throw partnerInChallenge();
}

/**
 * D56: the new partner joins the team's not-started entries. On a clash or an entry that
 * could not take them, the entry updates are undone first, then the team join.
 */
async function addToEntries(team, userId) {
  const entries = await Attempt.find({ teamId: team._id, status: { $in: NOT_STARTED } }, { _id: 1 });
  if (entries.length === 0) return;
  const user = await User.findById(userId, { username: 1 });
  const done = [];
  let failure = null;
  try {
    for (const entry of entries) {
      const res = await Attempt.updateOne(
        { _id: entry._id, status: { $in: NOT_STARTED }, 'players.1': { $exists: false } },
        { $push: { memberIds: userId, players: { id: String(userId), kind: 'user', name: user.username } } },
      );
      if (res.modifiedCount === 1) {
        done.push(entry._id);
      } else if (await Attempt.exists({ _id: entry._id, status: { $in: NOT_STARTED } })) {
        // Still not started but it took no one: the team changed under us.
        throw new AppError(409, 'TEAM_CHANGED', 'The team changed while you were doing that. Try again.');
      }
    }
    return;
  } catch (err) {
    failure = err.code === 11000 ? partnerInChallenge() : err;
  }
  try {
    await Attempt.updateMany({ _id: { $in: done } }, { $pull: { memberIds: userId, players: { id: String(userId) } } });
    await Team.updateOne({ _id: team._id }, { $pull: { memberIds: userId } });
  } catch (rollbackErr) {
    console.error(`joinTeam rollback failed for team ${team._id}, user ${userId}:`, rollbackErr);
  }
  throw failure;
}

async function joinTeam(userId, code) {
  const inviteCode = code.trim().toUpperCase();
  const preTeam = await Team.findOne({ inviteCode, archived: false }, { _id: 1 });
  if (preTeam) await assertPartnerFree(preTeam._id, userId);
  const team = await Team.findOneAndUpdate(
    { inviteCode, archived: false, memberIds: { $ne: userId }, 'memberIds.1': { $exists: false } },
    { $push: { memberIds: userId } },
    { returnDocument: 'after' },
  ).populate('memberIds', MEMBER_FIELDS);
  if (team) {
    await addToEntries(team, userId);
    return toView(team, userId);
  }

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
  if (team.archived) throw notFound(); // the former captain of an archived team
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
  // TEAM-7: no membership changes while the team is playing.
  if (await Attempt.exists({ teamId: team._id, status: { $in: RUNNING } })) {
    throw new AppError(409, 'TEAM_IN_ATTEMPT', 'Your team is in an attempt right now');
  }

  const remaining = memberIds.filter((id) => id !== target);
  const update = remaining.length === 0
    ? { $set: { memberIds: [], archived: true }, $unset: { inviteCode: 1 } }
    : { $set: { memberIds: remaining, captainId: String(team.captainId) === target ? remaining[0] : team.captainId } };

  // Only apply if membership is unchanged since we read it (optimistic check).
  const result = await Team.updateOne({ _id: team._id, memberIds: { $size: memberIds.length, $all: memberIds } }, update);
  if (result.modifiedCount !== 1) {
    throw new AppError(409, 'TEAM_CHANGED', 'The team changed while you were doing that. Try again.');
  }
  await syncEntries(team._id, target, remaining.length === 0);
}

/** D56: pull the leaver from not-started entries (they must ready up again); delete them with an archived team. */
async function syncEntries(teamId, targetId, archived) {
  const mine = { teamId, status: { $in: NOT_STARTED } };
  if (archived) {
    await Attempt.deleteMany(mine);
    return;
  }
  await Attempt.updateMany(mine, { $set: { 'players.$[].ready': false } });
  await Attempt.updateMany(mine, { $pull: { memberIds: targetId, players: { id: targetId } } });
}

module.exports = {
  toView, createTeam, listMine, getTeam, joinTeam, renameTeam, regenerateInvite, removeMember, addToEntries,
};
