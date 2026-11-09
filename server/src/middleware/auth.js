const mongoose = require('mongoose');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { verifyToken } = require('../services/tokenService');

function readBearer(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in');
  return token;
}

/** Any valid token, player or guest. Sets req.auth = { kind, id, nickname? }. */
function requireAuth(req, res, next) {
  const payload = verifyToken(readBearer(req));
  req.auth = { kind: payload.kind, id: payload.sub };
  if (payload.nickname) req.auth.nickname = payload.nickname;
  next();
}

/** A registered player. Loads the user fresh so role changes apply at once (DECISIONS D4). */
async function requirePlayer(req, res, next) {
  requireAuth(req, res, () => {});
  if (req.auth.kind !== 'user') {
    throw new AppError(403, 'GUEST_NOT_ALLOWED', 'Guests can only play practice games. Sign up to use this.');
  }
  const user = mongoose.isValidObjectId(req.auth.id) ? await User.findById(req.auth.id) : null;
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again');
  req.user = user;
  next();
}

/** Use after requirePlayer. Passes when the user holds any of the given roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.some((r) => req.user.roles.includes(r))) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that');
    }
    next();
  };
}

module.exports = { requireAuth, requirePlayer, requireRole };
