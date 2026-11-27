const express = require('express');
const { body, query } = require('express-validator');
const patterns = require('../utils/patterns');
const { AVATAR_COLORS } = require('../models/User');
const validate = require('../middleware/validate');
const { requirePlayer } = require('../middleware/auth');
const users = require('../controllers/userController');

/** `?page=` for history lists (SCORE-7): a whole number from 1; defaults to 1. */
const pageRules = [
  query('page').optional().not().isArray().withMessage('Page must be a whole number from 1').bail().isInt({ min: 1, max: 100000 }).withMessage('Page must be a whole number from 1').toInt(),
];

/** AUTH-7 (D105): username (AUTH-1) and/or a colour from the palette; at least one. */
const profileRules = [
  body().custom((b) => b && (b.username !== undefined || b.avatarColor !== undefined))
    .withMessage('Send a new username or avatar colour'),
  body('username').optional().isString().withMessage('Username must be text').bail()
    .matches(patterns.USERNAME).withMessage('Username must be 3-20 letters, digits or underscores'),
  body('avatarColor').optional().isString().withMessage('Choose a colour from the list').bail()
    .isIn(AVATAR_COLORS).withMessage('Choose a colour from the list'),
];

function createUserRouter() {
  const router = express.Router();
  router.use(requirePlayer);

  router.get('/me', users.me);
  router.patch('/me', validate(profileRules), users.updateMe);
  router.get('/me/history', validate(pageRules), users.myHistory);

  return router;
}

module.exports = { createUserRouter, pageRules };
