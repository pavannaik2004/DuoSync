const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requirePlayer } = require('../middleware/auth');
const patterns = require('../utils/patterns');
const teams = require('../controllers/teamController');
const { pageRules } = require('./userRoutes');

const nameRules = [
  body('name').isString().withMessage('Team name is required').bail()
    .matches(patterns.TEAM_NAME)
    .withMessage('Team name must be 3-24 letters, digits, spaces, _ or -'),
];

const codeRules = [
  body('code').isString().withMessage('Invite code is required').bail()
    .trim().isLength({ min: 1, max: 16 }).isAlphanumeric()
    .withMessage('Invite codes contain only letters and digits'),
];

function createTeamRouter() {
  const router = express.Router();
  router.use(requirePlayer);

  router.post('/', validate(nameRules), teams.create);
  router.get('/mine', teams.mine);
  router.post('/join', validate(codeRules), teams.join);
  router.get('/:id', teams.show);
  router.get('/:id/history', validate(pageRules), teams.teamHistory);
  router.patch('/:id', validate(nameRules), teams.rename);
  router.post('/:id/invite-code', teams.newInviteCode);
  router.delete('/:id/members/:userId', teams.removeMember);

  return router;
}

module.exports = { createTeamRouter };
