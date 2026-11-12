/**
 * Game history and records (SCORE-7, TEAM-3, TEAM-6; DECISIONS D77). Queries on attempts, like
 * the leaderboards: only ended challenge attempts count, practice never does.
 */
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const { rankOf } = require('./leaderboardService');

const PAGE_SIZE = 10; // SCORE-7
const played = () => ({ challengeId: { $type: 'objectId' }, status: { $in: Attempt.FINAL } });
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * One page of history, newest first. `filter` is { memberId } or { teamId }. Returns
 * { items, page, pageSize, total, pages }; a page past the end has no items.
 */
async function history({ memberId, teamId }, page = 1) {
  const match = played();
  if (memberId) match.memberIds = oid(memberId);
  if (teamId) match.teamId = oid(teamId);
  const [{ items, total }] = await Attempt.aggregate([
    { $match: match },
    { $sort: { finishedAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
          { $lookup: { from: 'challenges', localField: 'challengeId', foreignField: '_id', as: 'challenge' } },
          { $lookup: { from: 'teams', localField: 'teamId', foreignField: '_id', as: 'team' } },
          {
            // Named fields only: the challenge's levels (with answers) never leave this stage (NFR-1).
            $project: {
              challengeId: 1, teamId: 1, status: 1, totalPoints: 1, levelsCleared: 1, timeUsedMs: 1, stars: 1, finishedAt: 1,
              themeName: '$theme.name',
              challengeCode: { $first: '$challenge.code' },
              challengeName: { $first: '$challenge.name' },
              teamName: { $first: '$team.name' },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  const count = total.length ? total[0].n : 0;
  const rows = await Promise.all(items.map(async (a) => ({
    attemptId: String(a._id),
    challenge: { code: a.challengeCode || null, name: a.challengeName || 'Deleted challenge' },
    theme: { name: a.themeName || null },
    team: { id: String(a.teamId), name: a.teamName || 'Unknown team' },
    points: a.totalPoints,
    levelsCleared: a.levelsCleared,
    stars: a.stars,
    status: a.status,
    rank: await rankOf(a),
    finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
  })));
  return { items: rows, page, pageSize: PAGE_SIZE, total: count, pages: Math.ceil(count / PAGE_SIZE) };
}

/** AUTH-6 totals: challenges played, total points and best rank over the player's ended challenge attempts. */
async function playerTotals(userId) {
  const match = { ...played(), memberIds: oid(userId) };
  const [totals] = await Attempt.aggregate([
    { $match: match },
    { $group: { _id: null, challengesPlayed: { $sum: 1 }, totalPoints: { $sum: '$totalPoints' } } },
  ]);
  const attempts = await Attempt.find(match, { challengeId: 1, status: 1, totalPoints: 1, levelsCleared: 1, timeUsedMs: 1, finishedAt: 1 });
  const ranks = await Promise.all(attempts.map((a) => rankOf(a)));
  const positions = ranks.filter(Boolean).map((r) => r.position);
  return {
    challengesPlayed: totals ? totals.challengesPlayed : 0,
    totalPoints: totals ? totals.totalPoints : 0,
    bestRank: positions.length ? Math.min(...positions) : null,
  };
}

/** TEAM-3: { teamId → { played, totalPoints } } for the given teams (missing teams have no games). */
async function teamRecords(teamIds) {
  const groups = await Attempt.aggregate([
    { $match: { ...played(), teamId: { $in: teamIds.map(oid) } } },
    { $group: { _id: '$teamId', played: { $sum: 1 }, totalPoints: { $sum: '$totalPoints' } } },
  ]);
  return new Map(groups.map((g) => [String(g._id), { played: g.played, totalPoints: g.totalPoints }]));
}

module.exports = {
  history, playerTotals, teamRecords, PAGE_SIZE,
};
