/**
 * Challenge leaderboards (SCORE-3, SCORE-4; PRD §7.3, §9.1; DECISIONS D72, D74). Leaderboards are
 * queries on attempts, never stored, so they cannot drift. `boardView` is the only place a
 * leaderboard row is built: team name and results only, never levels or answers (NFR-1, NFR-4).
 */
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Challenge = require('../models/Challenge');
const AppError = require('../utils/AppError');
const { rankCompare } = require('./scoring');
const { statusOf } = require('./challengeService');

const { FINAL } = Attempt;
const PLAYING = ['countdown', 'in_progress', 'paused'];
const WAITING = ['entered', 'lobby'];
const LEVELS = 5;

const notFound = () => new AppError(404, 'CHALLENGE_NOT_FOUND', 'No challenge has that code');

async function findChallenge(challengeId) {
  const challenge = mongoose.isValidObjectId(challengeId) ? await Challenge.findById(challengeId) : null;
  if (!challenge) throw notFound();
  return challenge;
}

/** Ranks sorted rows: teams equal on all four §7.3 keys share a rank (1, 1, 3). */
function withRanks(sorted) {
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || rankCompare(sorted[i - 1], row) !== 0) rank = i + 1;
    return { ...row, rank };
  });
}

/** The leaderboard payload. Copies named fields only. */
function boardView(challenge, status, { ranked, playing, waiting }) {
  const closed = status === 'closed' || status === 'closing';
  return {
    challengeId: String(challenge._id),
    status,
    provisional: status !== 'closed',
    ranked: withRanks(ranked).map((r) => ({
      rank: r.rank,
      teamId: String(r.teamId),
      teamName: r.teamName,
      points: r.totalPoints,
      levelsCleared: r.levelsCleared,
      timeUsedMs: r.timeUsedMs,
      stars: r.stars,
      status: r.status,
      finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
    })),
    playing: playing.map((p) => ({
      teamId: String(p.teamId),
      teamName: p.teamName,
      levelReached: Math.min(LEVELS, p.levelsCleared + 1),
      paused: p.status === 'paused',
    })),
    // §7.1: once the window has closed, an entered team that never started "did not start".
    waiting: waiting.map((w) => ({ teamId: String(w.teamId), teamName: w.teamName, didNotStart: closed })),
  };
}

/**
 * The challenge's leaderboard (Lab 8 aggregation): ranked final attempts, teams playing now with the
 * level they reached, and teams that have not started. Provisional until the challenge is closed.
 */
async function leaderboardFor(challengeId, now) {
  const challenge = await findChallenge(challengeId);
  const fields = { teamId: 1, teamName: 1, status: 1, totalPoints: 1, levelsCleared: 1, timeUsedMs: 1, stars: 1, finishedAt: 1 };
  const [groups] = await Attempt.aggregate([
    { $match: { challengeId: challenge._id } },
    { $lookup: { from: 'teams', localField: 'teamId', foreignField: '_id', as: 'team' } },
    { $set: { teamName: { $ifNull: [{ $first: '$team.name' }, 'Unknown team'] } } },
    { $project: { ...fields, startedAt: 1, createdAt: 1 } },
    {
      $facet: {
        ranked: [
          { $match: { status: { $in: FINAL } } },
          { $sort: { totalPoints: -1, levelsCleared: -1, timeUsedMs: 1, finishedAt: 1, _id: 1 } },
        ],
        playing: [{ $match: { status: { $in: PLAYING } } }, { $sort: { levelsCleared: -1, startedAt: 1, _id: 1 } }],
        waiting: [{ $match: { status: { $in: WAITING } } }, { $sort: { createdAt: 1, _id: 1 } }],
      },
    },
  ]);
  const status = statusOf(challenge, now, groups.playing.length > 0);
  return boardView(challenge, status, groups);
}

/**
 * D74: 1 + the number of final attempts in the same challenge strictly ahead by §7.3 (Lab 7:
 * $or of comparison selectors). Null for practice and for attempts that have not ended.
 */
async function rankOf(attempt, now = Date.now()) {
  if (!attempt || !attempt.challengeId || !FINAL.includes(attempt.status)) return null;
  const { challengeId, totalPoints: p, levelsCleared: l, timeUsedMs: t, finishedAt: f } = attempt;
  const base = { challengeId, status: { $in: FINAL } };
  const [ahead, outOf, challenge, running] = await Promise.all([
    Attempt.countDocuments({
      ...base,
      $or: [
        { totalPoints: { $gt: p } },
        { totalPoints: p, levelsCleared: { $gt: l } },
        { totalPoints: p, levelsCleared: l, timeUsedMs: { $lt: t } },
        { totalPoints: p, levelsCleared: l, timeUsedMs: t, finishedAt: { $lt: f } },
      ],
    }),
    Attempt.countDocuments(base),
    Challenge.findById(challengeId, { startsAt: 1, endsAt: 1 }),
    Attempt.exists({ challengeId, status: { $in: PLAYING } }),
  ]);
  const provisional = !challenge || statusOf(challenge, now, Boolean(running)) !== 'closed';
  return { position: ahead + 1, outOf, provisional };
}

module.exports = { leaderboardFor, rankOf, findChallenge };
