const express = require('express');
const { requireAuth } = require('../middleware/auth');
const themes = require('../controllers/themeController');

/** The theme catalogue: any signed-in player or guest. */
function createThemeRouter() {
  const router = express.Router();
  router.use(requireAuth);
  router.get('/', themes.list);
  return router;
}

module.exports = { createThemeRouter };
