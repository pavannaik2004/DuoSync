const express = require('express');

/** Builds the /api router. Feature routers are mounted here. */
function createApiRouter() {
  const router = express.Router();

  router.get('/health', (req, res) => res.json({ status: 'ok' }));

  return router;
}

module.exports = { createApiRouter };
