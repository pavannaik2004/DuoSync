import PropTypes from 'prop-types';

/** PropTypes for the attempt payloads the server sends (see server/src/services/attemptView.js). */
export const roleShape = PropTypes.shape({ name: PropTypes.string.isRequired, description: PropTypes.string.isRequired });
export const rolesShape = PropTypes.shape({ A: roleShape.isRequired, B: roleShape.isRequired });

export const playerShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  role: PropTypes.oneOf(['A', 'B', null]),
  ready: PropTypes.bool.isRequired,
  connected: PropTypes.bool.isRequired,
});

export const messageShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  kind: PropTypes.oneOf(['user', 'system']).isRequired,
  senderName: PropTypes.string,
  role: PropTypes.oneOf(['A', 'B', null]),
  text: PropTypes.string.isRequired,
  createdAt: PropTypes.string.isRequired,
});

export const clueShape = PropTypes.shape({
  type: PropTypes.string.isRequired,
  data: PropTypes.object.isRequired,
});

export const hintShape = PropTypes.shape({ ready: PropTypes.bool.isRequired, text: PropTypes.string });

export const levelBarShape = PropTypes.shape({
  order: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  state: PropTypes.oneOf(['solved', 'current', 'locked']).isRequired,
  points: PropTypes.number.isRequired,
  wrongCount: PropTypes.number.isRequired,
});

export const boardEntryShape = PropTypes.shape({
  order: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  reward: PropTypes.string,
});

export const pauseShape = PropTypes.shape({
  clockStopped: PropTypes.bool.isRequired,
  away: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['A', 'B', null]),
    graceMs: PropTypes.number,
  })).isRequired,
  budgetLeftMs: PropTypes.number,
});

export const rankShape = PropTypes.shape({
  position: PropTypes.number.isRequired,
  outOf: PropTypes.number.isRequired,
  provisional: PropTypes.bool.isRequired,
});

export const resultShape = PropTypes.shape({
  status: PropTypes.string.isRequired,
  levels: PropTypes.arrayOf(PropTypes.shape({
    order: PropTypes.number.isRequired,
    title: PropTypes.string.isRequired,
    solved: PropTypes.bool.isRequired,
    points: PropTypes.number.isRequired,
    wrongCount: PropTypes.number.isRequired,
  })).isRequired,
  levelPoints: PropTypes.number.isRequired,
  bonus: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  stars: PropTypes.number.isRequired,
  levelsCleared: PropTypes.number.isRequired,
  wrongAnswers: PropTypes.number.isRequired,
  timeUsedMs: PropTypes.number.isRequired,
  text: PropTypes.string,
  rank: rankShape,
});

export const attemptShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  practiceCode: PropTypes.string,
  status: PropTypes.string.isRequired,
  theme: PropTypes.shape({
    name: PropTypes.string.isRequired,
    story: PropTypes.string.isRequired,
    timerMinutes: PropTypes.number.isRequired,
    roles: rolesShape.isRequired,
  }).isRequired,
  me: PropTypes.shape({ id: PropTypes.string.isRequired, role: PropTypes.oneOf(['A', 'B', null]) }).isRequired,
  players: PropTypes.arrayOf(playerShape).isRequired,
  countdownEndsAt: PropTypes.string,
  remainingMs: PropTypes.number,
  levels: PropTypes.arrayOf(levelBarShape).isRequired,
  board: PropTypes.arrayOf(boardEntryShape).isRequired,
  score: PropTypes.number.isRequired,
  chat: PropTypes.arrayOf(messageShape).isRequired,
  pause: pauseShape,
});

export const gameActionsShape = PropTypes.shape({
  claimRole: PropTypes.func.isRequired,
  releaseRole: PropTypes.func.isRequired,
  ready: PropTypes.func.isRequired,
  cancel: PropTypes.func.isRequired,
  sendChat: PropTypes.func.isRequired,
  submit: PropTypes.func.isRequired,
  quit: PropTypes.func.isRequired,
  revealHint: PropTypes.func.isRequired,
});
