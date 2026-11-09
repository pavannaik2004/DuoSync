const express = require('express');
const { requireAuth } = require('../middleware/auth');
const practice = require('../controllers/practiceController');

/** Practice rooms: open to players and guests (PRAC-1, DECISIONS D32). */
function createPracticeRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.post('/', practice.create);
  router.get('/:code', practice.show); // the service checks the code's shape

  return router;
}

module.exports = { createPracticeRouter };
