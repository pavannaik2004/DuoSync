/** The player's own profile (AUTH-6). */
const Team = require('../models/Team');
const { playerTotals } = require('./historyService');

async function profile(user) {
  const [teams, totals] = await Promise.all([
    Team.find({ memberIds: user._id }, { name: 1, archived: 1 }).sort({ createdAt: -1 }),
    playerTotals(user._id),
  ]);
  return {
    id: String(user._id),
    username: user.username,
    avatarColor: user.avatarColor,
    joinedAt: user.createdAt.toISOString(),
    teams: teams.map((t) => ({ id: String(t._id), name: t.name, archived: t.archived })),
    ...totals,
  };
}

module.exports = { profile };
