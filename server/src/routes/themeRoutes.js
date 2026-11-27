const express = require('express');
const { param } = require('express-validator');
const validate = require('../middleware/validate');
const { requireAuth, requirePlayer } = require('../middleware/auth');
const themes = require('../controllers/themeController');

/** The theme catalogue: any signed-in player or guest. */
function createThemeRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', themes.list);
  // SCORE-6 (D106): leaderboards are for players (§9.2), like challenge leaderboards.
  router.get(
    '/:slug/rankings',
    requirePlayer,
    validate([param('slug').matches(/^[a-z0-9-]{2,40}$/).withMessage('Not a theme slug')]),
    themes.rankings,
  );
  return router;
}

module.exports = { createThemeRouter };
