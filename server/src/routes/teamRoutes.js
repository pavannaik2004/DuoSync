const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requirePlayer } = require('../middleware/auth');
const patterns = require('../utils/patterns');
const teams = require('../controllers/teamController');

const nameRules = [
  body('name').isString().withMessage('Team name is required').bail()
    .matches(patterns.TEAM_NAME)
    .withMessage('Team name must be 3-24 letters, digits, spaces, _ or -'),
];

function createTeamRouter() {
  const router = express.Router();
  router.use(requirePlayer);

  router.post('/', validate(nameRules), teams.create);
  router.get('/mine', teams.mine);
  router.get('/:id', teams.show);

  return router;
}

module.exports = { createTeamRouter };
