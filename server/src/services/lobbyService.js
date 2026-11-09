/**
 * Team lobby rules (LOBBY-2, LOBBY-3) and the attempt start (GAME-1). Each function
 * loads the attempt, changes it and saves it. Callers run them inside the attempt's
 * queue, so two changes never interleave.
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { getContent } = require('../content');

async function load(attemptId) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'That game no longer exists');
  return attempt;
}

function playerOf(attempt, playerId) {
  const player = attempt.players.find((p) => p.id === playerId);
  if (!player) throw new AppError(403, 'NOT_IN_ATTEMPT', 'Join the game before doing that');
  return player;
}

function assertLobby(attempt) {
  if (attempt.status !== 'lobby') throw new AppError(409, 'NOT_IN_LOBBY', 'Roles can only change in the lobby');
}

/** Both players present and online, holding roles A and B, and ready. */
function canStart(attempt, connectedIds) {
  const { players } = attempt;
  return players.length === 2
    && players.map((p) => p.role).sort().join('') === 'AB'
    && players.every((p) => p.ready && connectedIds.includes(p.id));
}

/** LOBBY-2: a role held by the partner is locked. Claiming clears ready. */
async function claimRole(attemptId, playerId, role) {
  const attempt = await load(attemptId);
  assertLobby(attempt);
  const me = playerOf(attempt, playerId);
  if (attempt.players.some((p) => p.id !== playerId && p.role === role)) {
    throw new AppError(409, 'ROLE_TAKEN', 'Your teammate already has that role');
  }
  me.role = role;
  me.ready = false;
  await attempt.save();
  return attempt;
}

async function releaseRole(attemptId, playerId) {
  const attempt = await load(attemptId);
  assertLobby(attempt);
  const me = playerOf(attempt, playerId);
  me.role = null;
  me.ready = false;
  await attempt.save();
  return attempt;
}

/** LOBBY-3: when both players are online, hold roles and are ready, the countdown starts. */
async function setReady(attemptId, playerId, { connectedIds, now, countdownMs }) {
  const attempt = await load(attemptId);
  const me = playerOf(attempt, playerId);
  if (attempt.status === 'countdown' && me.ready) return attempt;
  assertLobby(attempt);
  if (!me.role) throw new AppError(409, 'ROLE_REQUIRED', 'Pick a role before you get ready');
  me.ready = true;
  if (canStart(attempt, connectedIds)) {
    attempt.status = 'countdown';
    attempt.countdownEndsAt = new Date(now + countdownMs);
  }
  await attempt.save();
  return attempt;
}

/** Clears this player's ready flag. During the countdown it also cancels it (LOBBY-3). */
async function unready(attemptId, playerId) {
  const attempt = await load(attemptId);
  if (!['lobby', 'countdown'].includes(attempt.status)) throw new AppError(409, 'NOT_IN_LOBBY', 'The game has already started');
  playerOf(attempt, playerId).ready = false;
  if (attempt.status === 'countdown') {
    attempt.status = 'lobby';
    attempt.countdownEndsAt = null;
  }
  await attempt.save();
  return attempt;
}

/** GAME-1: copies the level set into the attempt and starts the timer. Null if the countdown was cancelled. */
async function startAttempt(attemptId, { now, timerMs }) {
  const attempt = await load(attemptId);
  if (attempt.status !== 'countdown') return null;
  const { levels } = getContent(attempt.themeSlug);
  attempt.levels = levels.map((level, i) => ({ ...level, unlockedAt: i === 0 ? new Date(now) : null }));
  attempt.startedAt = new Date(now);
  attempt.endsAt = new Date(now + (timerMs || attempt.timerMinutes * 60 * 1000));
  attempt.status = 'in_progress';
  attempt.countdownEndsAt = null;
  await attempt.save();
  return attempt;
}

/** After a restart a half-finished countdown has no timer, so it goes back to the lobby (D37). */
async function resetCountdown(attemptId) {
  const attempt = await load(attemptId);
  if (attempt.status !== 'countdown') return attempt;
  attempt.status = 'lobby';
  attempt.countdownEndsAt = null;
  attempt.players.forEach((p) => { p.ready = false; });
  await attempt.save();
  return attempt;
}

module.exports = { claimRole, releaseRole, setReady, unready, startAttempt, resetCountdown, canStart };
