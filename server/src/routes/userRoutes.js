const express = require('express');
const { query } = require('express-validator');
const validate = require('../middleware/validate');
const { requirePlayer } = require('../middleware/auth');
const users = require('../controllers/userController');

/** `?page=` for history lists (SCORE-7): a whole number from 1; defaults to 1. */
const pageRules = [
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('Page must be a whole number from 1').toInt(),
];

function createUserRouter() {
  const router = express.Router();
  router.use(requirePlayer);

  router.get('/me', users.me);
  router.get('/me/history', validate(pageRules), users.myHistory);

  return router;
}

module.exports = { createUserRouter, pageRules };
