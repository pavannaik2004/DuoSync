const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Who is playing, from a verified token: { id, kind, name }. Players are looked up
 * so the name is their current username; guests use the nickname in their token.
 */
async function resolveIdentity({ kind, id, nickname }) {
  if (kind === 'guest') return { id: String(id), kind, name: nickname };
  const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again');
  return { id: String(user._id), kind: 'user', name: user.username };
}

module.exports = { resolveIdentity };
