const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const AppError = require('../utils/AppError');

const WINDOW_MS = 60 * 1000;

const handler = (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Wait a minute and try again.'));

/** The account a request is for: the lowercased email or guest nickname, '' when missing or not text. */
function accountOf(req) {
  const value = req.body && (req.body.email !== undefined ? req.body.email : req.body.nickname);
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * NFR-6 with Q7 (D93): `perKey` requests per minute for one IP + account, and a per-IP ceiling of `perIp`, never
 * below 10 × perKey, so 50 students behind one college NAT can each sign up. ipKeyGenerator groups IPv6 addresses.
 */
function createAuthLimiters({ perKey, perIp }) {
  const common = { windowMs: WINDOW_MS, standardHeaders: 'draft-8', legacyHeaders: false, handler };
  return {
    byIp: rateLimit({ ...common, limit: Math.max(perIp, 10 * perKey), identifier: 'auth-ip' }),
    byAccount: rateLimit({
      ...common,
      limit: perKey,
      identifier: 'auth-account',
      keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${accountOf(req)}`,
    }),
  };
}

module.exports = { createAuthLimiters };
