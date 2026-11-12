const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { requirePlayer } = require('../middleware/auth');
const patterns = require('../utils/patterns');
const challenges = require('../controllers/challengeController');

const nameRule = (chain) => chain.isString().withMessage('Challenge name is required').bail()
  .matches(patterns.CHALLENGE_NAME)
  .withMessage("Challenge name must be 3-40 letters, digits, spaces or _ ' ! ? -");
// NFR-18: an explicit Z or ±hh:mm offset is required, so a time is never read as server-local.
const OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const dateRule = (chain, label) => chain.isString().bail().isISO8601({ strict: true })
  .bail().matches(OFFSET)
  .withMessage(`${label} must be an ISO-8601 date with a Z or UTC offset`);
const maxTeamsRule = (chain) => chain.isInt({ min: 2, max: 500 })
  .withMessage('Max teams must be a whole number from 2 to 500').toInt();

const createRules = [
  nameRule(body('name')),
  body('theme').isString().withMessage('Choose a theme').bail()
    .matches(/^[a-z0-9-]{1,40}$/).withMessage('Choose a valid theme'),
  dateRule(body('startsAt'), 'Start time'),
  dateRule(body('endsAt'), 'End time'),
  body('visibility').isIn(['public', 'private']).withMessage('Visibility must be public or private'),
  maxTeamsRule(body('maxTeams').optional({ nullable: true })),
];

const updateRules = [
  nameRule(body('name').optional()),
  dateRule(body('startsAt').optional(), 'Start time'),
  dateRule(body('endsAt').optional(), 'End time'),
  maxTeamsRule(body('maxTeams').optional({ nullable: true })),
];

function createChallengeRouter() {
  const router = express.Router();
  router.use(requirePlayer);

  router.post('/', validate(createRules), challenges.create);
  router.get('/:code', challenges.show);
  router.patch('/:id', validate(updateRules), challenges.update);
  router.post('/:id/entries', validate([body('teamId').isString().withMessage('Choose a team')]), challenges.enter);
  router.delete('/:id', challenges.remove);
  router.get('/:id/leaderboard', challenges.leaderboard);

  return router;
}

module.exports = { createChallengeRouter };
