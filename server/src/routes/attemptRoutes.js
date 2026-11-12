const express = require('express');
const { requireAuth } = require('../middleware/auth');
const attempts = require('../controllers/attemptController');

/** Attempt results (SCORE-2, CHAT-4): players and practice guests read their own (D80). */
function createAttemptRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/:id/result', attempts.result);

  return router;
}

module.exports = { createAttemptRouter };
