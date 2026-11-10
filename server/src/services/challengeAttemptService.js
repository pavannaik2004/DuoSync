/** Opening a challenge attempt for play (D58): the window rules for the lobby (CHAL-7). */
const mongoose = require('mongoose');
const Attempt = require('../models/Attempt');
const Challenge = require('../models/Challenge');
const AppError = require('../utils/AppError');

const notFound = () => new AppError(404, 'ATTEMPT_NOT_FOUND', 'No challenge attempt has that id');

/** Loads a challenge attempt for a teammate. An entered attempt moves to the lobby inside the window. */
async function openAttempt(attemptId, identity, now) {
  if (identity.kind === 'guest') throw new AppError(403, 'GUEST_NOT_ALLOWED', 'Sign in to play a challenge');
  const found = mongoose.isValidObjectId(attemptId) ? await Attempt.findOne({ _id: attemptId, challengeId: { $ne: null } }) : null;
  if (!found) throw notFound();
  if (!found.players.some((p) => p.id === identity.id)) {
    throw new AppError(403, 'NOT_IN_ATTEMPT', 'You are not on this team');
  }
  if (found.status !== 'entered') return found;

  const challenge = await Challenge.findById(found.challengeId);
  if (!challenge) throw notFound();
  if (now < challenge.startsAt.getTime()) {
    throw new AppError(409, 'NOT_OPEN', `This challenge opens at ${challenge.startsAt.toISOString()}`);
  }
  if (now >= challenge.endsAt.getTime()) throw new AppError(409, 'CHALLENGE_CLOSED', 'The challenge window has closed');
  // Atomic, so two teammates opening at once both end up in the lobby.
  const opened = await Attempt.findOneAndUpdate(
    { _id: found._id, status: 'entered' }, { $set: { status: 'lobby' } }, { returnDocument: 'after' },
  );
  return opened || Attempt.findById(found._id);
}

module.exports = { openAttempt };
