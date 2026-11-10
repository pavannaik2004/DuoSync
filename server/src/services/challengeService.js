/** Challenges: a time window on one theme with a shared, generated level set (CHAL-1..CHAL-3). */
const Challenge = require('../models/Challenge');
const Attempt = require('../models/Attempt');
const Team = require('../models/Team');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const patterns = require('../utils/patterns');
const { generateCode } = require('./codeService');
const { loadThemeContent } = require('./themeService');
const { generateLevelSet, newSeed } = require('../generators/levelSet');
const { challengeView } = require('./challengeView');

const CODE_LENGTH = 6;
const MIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAST_GRACE_MS = 5 * 60 * 1000;
const RUNNING = ['countdown', 'in_progress', 'paused'];

const invalid = (message) => new AppError(400, 'VALIDATION_ERROR', message);
const notFound = () => new AppError(404, 'CHALLENGE_NOT_FOUND', 'No challenge has that code');
const isOrganizer = (user) => user.roles.includes('organizer') || user.roles.includes('admin');

/** D57: computed from the window and the attempts, never stored. */
function statusOf(challenge, now, hasRunning) {
  if (now < challenge.startsAt.getTime()) return 'upcoming';
  if (now < challenge.endsAt.getTime()) return 'open';
  return hasRunning ? 'closing' : 'closed';
}

function checkWindow(startsAt, endsAt) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw invalid('Use valid start and end times');
  const length = endsAt.getTime() - startsAt.getTime();
  if (length < MIN_WINDOW_MS) throw invalid('The challenge must run for at least 15 minutes');
  if (length > MAX_WINDOW_MS) throw invalid('The challenge can run for at most 30 days');
}

function checkStart(startsAt, now) {
  if (startsAt.getTime() < now - PAST_GRACE_MS) throw invalid('The start time cannot be in the past');
}

async function createChallenge(user, { name, theme, startsAt, endsAt, visibility, maxTeams }, now) {
  if (visibility === 'public' && !isOrganizer(user)) {
    throw new AppError(403, 'PUBLIC_NEEDS_ORGANIZER', 'Only organizers can create public challenges');
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  checkWindow(start, end);
  checkStart(start, now);

  const content = await loadThemeContent(theme);
  const { levels, seed, usedFallback } = generateLevelSet(content, newSeed()); // generated once (CHAL-2)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const challenge = await Challenge.create({
        code: generateCode(CODE_LENGTH),
        name,
        themeSlug: content.theme.slug,
        theme: content.theme,
        creatorId: user._id,
        visibility,
        startsAt: start,
        endsAt: end,
        maxTeams: maxTeams ?? null,
        seed,
        levels,
        usedFallback,
      });
      return { id: String(challenge._id), code: challenge.code };
    } catch (err) {
      if (err.code !== 11000) throw err; // retry only a code collision
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not generate a challenge code');
}

async function getChallengeByCode(code, user, now) {
  if (typeof code !== 'string' || !patterns.CHALLENGE_CODE.test(code)) throw notFound();
  const challenge = await Challenge.findOne({ code: code.toUpperCase() });
  if (!challenge) throw notFound();

  const [teamsEntered, running, teams] = await Promise.all([
    Attempt.countDocuments({ challengeId: challenge._id }),
    Attempt.exists({ challengeId: challenge._id, status: { $in: RUNNING } }),
    Team.find({ memberIds: user._id, archived: false }, { name: 1 }),
  ]);
  let myEntry = null;
  if (teams.length > 0) {
    const attempt = await Attempt.findOne({ challengeId: challenge._id, teamId: { $in: teams.map((t) => t._id) } });
    if (attempt) {
      const team = teams.find((t) => String(t._id) === String(attempt.teamId));
      myEntry = { attemptId: String(attempt._id), teamId: String(team._id), teamName: team.name, status: attempt.status };
    }
  }
  return challengeView(challenge, {
    status: statusOf(challenge, now, Boolean(running)),
    teamsEntered,
    viewerId: user._id,
    myEntry,
  });
}

async function ownChallenge(id, user) {
  const challenge = await Challenge.findById(id);
  if (!challenge) throw notFound();
  if (String(challenge.creatorId) !== String(user._id)) throw new AppError(403, 'NOT_CREATOR', 'Only the creator can do that');
  return challenge;
}

/** D61: name, window and maxTeams, only before startsAt; maxTeams may not drop below the entries. */
async function updateChallenge(id, user, patch, now) {
  const challenge = await ownChallenge(id, user);
  if (now >= challenge.startsAt.getTime()) throw new AppError(409, 'CHALLENGE_STARTED', 'This challenge has already started');

  const startsAt = patch.startsAt !== undefined ? new Date(patch.startsAt) : challenge.startsAt;
  const endsAt = patch.endsAt !== undefined ? new Date(patch.endsAt) : challenge.endsAt;
  if (patch.startsAt !== undefined || patch.endsAt !== undefined) {
    checkWindow(startsAt, endsAt);
    if (patch.startsAt !== undefined) checkStart(startsAt, now);
  }
  if (patch.maxTeams !== undefined && patch.maxTeams !== null) {
    const entered = await Attempt.countDocuments({ challengeId: challenge._id });
    if (patch.maxTeams < entered) {
      throw new AppError(409, 'MAX_TEAMS_TOO_LOW', `${entered} teams have already entered`);
    }
  }
  if (patch.name !== undefined) challenge.name = patch.name;
  if (patch.maxTeams !== undefined) challenge.maxTeams = patch.maxTeams;
  challenge.startsAt = startsAt;
  challenge.endsAt = endsAt;
  await challenge.save();
}

async function deleteChallenge(id, user) {
  const challenge = await ownChallenge(id, user);
  if (await Attempt.exists({ challengeId: challenge._id })) {
    throw new AppError(409, 'HAS_ENTRIES', 'A team has already entered this challenge');
  }
  await challenge.deleteOne();
}

/** CHAL-4: a full team enters; the unique indexes make one attempt per team and member (D56, NFR-7). */
async function enterChallenge(challengeId, user, { teamId }, now) {
  const challenge = mongoose.isValidObjectId(challengeId) ? await Challenge.findById(challengeId) : null;
  if (!challenge) throw notFound();
  const status = statusOf(challenge, now, false);
  if (status !== 'upcoming' && status !== 'open') throw new AppError(409, 'CHALLENGE_CLOSED', 'This challenge is closed');

  const team = mongoose.isValidObjectId(teamId)
    ? await Team.findById(teamId).populate('memberIds', 'username')
    : null;
  if (!team || team.archived || !team.memberIds.some((m) => String(m._id) === String(user._id))) {
    throw new AppError(403, 'NOT_TEAM_MEMBER', 'Choose a team you belong to');
  }
  if (team.memberIds.length !== 2) throw new AppError(409, 'TEAM_NOT_FULL', 'A team needs 2 members to enter');

  if (challenge.maxTeams !== null && (await Attempt.countDocuments({ challengeId: challenge._id })) >= challenge.maxTeams) {
    throw new AppError(409, 'CHALLENGE_FULL', 'This challenge has reached its team limit');
  }
  try {
    const attempt = await Attempt.create({
      challengeId: challenge._id,
      teamId: team._id,
      memberIds: team.memberIds.map((m) => m._id),
      players: team.memberIds.map((u) => ({ id: String(u._id), kind: 'user', name: u.username })),
      status: 'entered',
      themeSlug: challenge.themeSlug,
      theme: challenge.theme,
      timerMinutes: challenge.theme.timerMinutes,
    });
    return { attemptId: String(attempt._id) };
  } catch (err) {
    if (err.code !== 11000) throw err;
    if (await Attempt.exists({ challengeId: challenge._id, teamId: team._id })) {
      throw new AppError(409, 'ALREADY_ENTERED', 'Your team has already entered this challenge');
    }
    throw new AppError(409, 'MEMBER_IN_CHALLENGE', 'A member of this team has already entered with another team');
  }
}

module.exports = { enterChallenge, createChallenge, getChallengeByCode, updateChallenge, deleteChallenge, statusOf };
