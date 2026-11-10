const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const practice = require('../controllers/practiceController');

const themeRules = [
  body('theme').optional().isString().withMessage('theme must be a theme slug').bail()
    .matches(/^[a-z0-9-]{3,40}$/).withMessage('theme must be a theme slug'),
];

/** Practice rooms: open to players and guests (PRAC-1, DECISIONS D32). */
function createPracticeRouter() {
  const router = express.Router();
  router.use(requireAuth);

  router.post('/', validate(themeRules), practice.create);
  router.get('/:code', practice.show); // the service checks the code's shape

  return router;
}

module.exports = { createPracticeRouter };
