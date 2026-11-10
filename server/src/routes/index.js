const express = require('express');
const { createAuthRouter } = require('./authRoutes');
const { createTeamRouter } = require('./teamRoutes');
const { createPracticeRouter } = require('./practiceRoutes');
const { createThemeRouter } = require('./themeRoutes');

/** Builds the /api router. Feature routers are mounted here. */
function createApiRouter({ authRateLimit }) {
  const router = express.Router();

  router.get('/health', (req, res) => res.json({ status: 'ok' }));
  router.use('/auth', createAuthRouter({ authRateLimit }));
  router.use('/teams', createTeamRouter());
  router.use('/practice', createPracticeRouter());
  router.use('/themes', createThemeRouter());

  return router;
}

module.exports = { createApiRouter };
