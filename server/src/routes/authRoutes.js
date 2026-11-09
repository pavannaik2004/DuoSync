const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { createAuthLimiter } = require('../middleware/rateLimit');
const patterns = require('../utils/patterns');
const auth = require('../controllers/authController');

// isString() first: an object such as { $ne: null } never reaches a query (NFR-5).
const str = (field, label) => body(field).isString().withMessage(`${label} is required`).bail();

const signupRules = [
  str('username', 'Username').trim().matches(patterns.USERNAME)
    .withMessage('Username must be 3-20 letters, digits or underscores'),
  str('email', 'Email').trim().isLength({ max: 254 }).matches(patterns.EMAIL)
    .withMessage('Enter a valid email address'),
  str('password', 'Password').matches(patterns.PASSWORD)
    .withMessage('Password must be at least 8 characters with a letter and a digit'),
];

const loginRules = [
  str('email', 'Email').trim().notEmpty().withMessage('Email is required').isLength({ max: 254 }),
  str('password', 'Password').notEmpty().withMessage('Password is required').isLength({ max: 72 }),
];

function createAuthRouter({ authRateLimit }) {
  const router = express.Router();
  const limiter = createAuthLimiter(authRateLimit);

  router.post('/signup', limiter, validate(signupRules), auth.signup);
  router.post('/login', limiter, validate(loginRules), auth.login);

  return router;
}

module.exports = { createAuthRouter };
