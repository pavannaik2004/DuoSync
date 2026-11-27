/** The player's own profile (AUTH-6). */
const Team = require('../models/Team');
const User = require('../models/User');
const AppError = require('../utils/AppError');
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
    avatarColors: User.AVATAR_COLORS,
    joinedAt: user.createdAt.toISOString(),
    teams: teams.map((t) => ({ id: String(t._id), name: t.name, archived: t.archived })),
    ...totals,
  };
}

/**
 * AUTH-7 (D105): change the username and/or avatar colour. The fields are already validated;
 * a name another player holds in any case is 409 USERNAME_TAKEN.
 */
async function updateProfile(user, { username, avatarColor }) {
  const changes = {};
  if (username !== undefined) changes.username = username;
  if (avatarColor !== undefined) changes.avatarColor = avatarColor;
  try {
    const updated = await User.findByIdAndUpdate(user._id, { $set: changes }, { new: true, runValidators: true });
    return profile(updated);
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'USERNAME_TAKEN', 'That username is taken');
    throw err;
  }
}

module.exports = { profile, updateProfile };
