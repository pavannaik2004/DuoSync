/** ADMIN-6 / D90: find users and grant or remove the organizer role. The admin role is never changed here. */
const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/jsonGuard');

const LIMIT = 20;

const rowOf = (u) => ({ id: String(u._id), username: u.username, email: u.email, roles: u.roles, createdAt: u.createdAt });

async function searchUsers(q) {
  const pattern = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({ $or: [{ username: pattern }, { email: pattern }] })
    .collation(User.CASE_INSENSITIVE).sort({ username: 1 }).limit(LIMIT).lean();
  return users.map(rowOf);
}

async function setOrganizer(userId, on) {
  const update = on ? { $addToSet: { roles: 'organizer' } } : { $pull: { roles: 'organizer' } };
  const user = mongoose.isValidObjectId(userId)
    ? await User.findByIdAndUpdate(userId, update, { returnDocument: 'after' }).lean()
    : null;
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'That user does not exist');
  return rowOf(user);
}

module.exports = { searchUsers, setOrganizer };
