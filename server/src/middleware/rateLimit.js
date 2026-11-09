const { rateLimit } = require('express-rate-limit');
const AppError = require('../utils/AppError');

/** Login and signup limiter: `max` requests per minute per IP (NFR-6). */
function createAuthLimiter(max) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Wait a minute and try again.')),
  });
}

module.exports = { createAuthLimiter };
