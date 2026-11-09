const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');

const EXPIRY = { user: '7d', guest: '24h' }; // NFR-2

/** Signs `{ sub, kind, nickname? }`. Roles are never put in the token (DECISIONS D4). */
function signToken({ sub, kind, nickname }) {
  const claims = { kind };
  if (nickname) claims.nickname = nickname;
  return jwt.sign(claims, config.jwtSecret, { subject: String(sub), expiresIn: EXPIRY[kind] });
}

/** Returns the payload, or throws 401 AUTH_REQUIRED for a bad or expired token. */
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload.sub || !EXPIRY[payload.kind]) throw new Error('bad payload');
    return payload;
  } catch {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again');
  }
}

module.exports = { signToken, verifyToken };
