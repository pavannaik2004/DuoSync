/** An attempt's results for its own players (SCORE-2, CHAT-4; DECISIONS D80). */
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Challenge = require('../models/Challenge');
const AppError = require('../utils/AppError');
const { recentMessages } = require('./chatService');
const { resultView, messageView, themeOf } = require('./attemptView');
const { rankOf } = require('./leaderboardService');

/**
 * The result, current rank and chat log of an ended attempt. `identity.id` is the token
 * subject (a user id or a guest id), matched against the attempt's players.
 */
async function getResult(attemptId, identity) {
  const attempt = mongoose.isValidObjectId(attemptId) ? await Attempt.findById(attemptId) : null;
  if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'No game has that id');
  if (!attempt.players.some((p) => p.id === identity.id)) {
    throw new AppError(403, 'NOT_IN_ATTEMPT', 'You did not play in this game');
  }
  if (!Attempt.FINAL.includes(attempt.status)) throw new AppError(409, 'NOT_FINISHED', 'This game has not ended yet');

  const [rank, messages, challenge] = await Promise.all([
    rankOf(attempt),
    recentMessages(attempt._id),
    attempt.challengeId ? Challenge.findById(attempt.challengeId, { code: 1, name: 1 }) : null,
  ]);
  const theme = themeOf(attempt);
  return {
    attemptId: String(attempt._id),
    challenge: challenge ? { id: String(challenge._id), code: challenge.code, name: challenge.name } : null,
    theme: { name: theme.name, roles: theme.roles },
    result: resultView(attempt, { rank }),
    chat: messages.map(messageView),
  };
}

module.exports = { getResult };
