/**
 * SCORE-6 (D106): the overall team ranking for one theme. Each team's best final challenge
 * attempt in that theme, compared by §7.3, top 20 (Lab 8 aggregation: $match, $sort, $group,
 * $lookup). Practice and unfinished attempts never count. A query on attempts, never stored.
 */
const Attempt = require('../models/Attempt');
const Theme = require('../models/Theme');
const { withRanks } = require('./leaderboardService');

const { FINAL } = Attempt;
const LIMIT = 20;
const ORDER = { totalPoints: -1, levelsCleared: -1, timeUsedMs: 1, finishedAt: 1, _id: 1 };

async function themeRankings(slug) {
  const [theme, best] = await Promise.all([
    Theme.findOne({ slug }, { slug: 1, name: 1 }),
    Attempt.aggregate([
      { $match: { themeSlug: slug, challengeId: { $ne: null }, teamId: { $ne: null }, status: { $in: FINAL } } },
      { $sort: ORDER },
      { $group: { _id: '$teamId', best: { $first: '$$ROOT' } } },
      { $replaceWith: '$best' },
      { $sort: ORDER },
      { $limit: LIMIT },
      { $lookup: { from: 'teams', localField: 'teamId', foreignField: '_id', as: 'team' } },
      { $lookup: { from: 'challenges', localField: 'challengeId', foreignField: '_id', as: 'challenge' } },
      {
        $project: {
          teamId: 1, totalPoints: 1, levelsCleared: 1, timeUsedMs: 1, finishedAt: 1, stars: 1,
          teamName: { $ifNull: [{ $first: '$team.name' }, 'Unknown team'] },
          challengeName: { $ifNull: [{ $first: '$challenge.name' }, 'Deleted challenge'] },
        },
      },
    ]),
  ]);
  return {
    theme: theme ? { slug: theme.slug, name: theme.name } : null,
    rows: withRanks(best).map((r) => ({
      rank: r.rank,
      teamId: String(r.teamId),
      teamName: r.teamName,
      points: r.totalPoints,
      levelsCleared: r.levelsCleared,
      timeUsedMs: r.timeUsedMs,
      stars: r.stars,
      challengeName: r.challengeName,
      playedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
    })),
  };
}

module.exports = { themeRankings, LIMIT };
