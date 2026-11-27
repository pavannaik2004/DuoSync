const Attempt = require('../models/Attempt');
const Message = require('../models/Message');
const AppError = require('../utils/AppError');
const patterns = require('../utils/patterns');
const { generateCode } = require('./codeService');
const { loadThemeContent } = require('./themeService');
const { themeOf } = require('./attemptView');

const CODE_LENGTH = 6; // PRAC-1
const DEFAULT_THEME = 'cyber-heist';
const PRACTICE_IDLE_MS = 30 * 60 * 1000; // PRAC-4
const NEVER_PLAYED = ['lobby', 'countdown'];

const notFound = () => new AppError(404, 'PRACTICE_NOT_FOUND', 'No practice room has that code');
const asPlayer = (identity) => ({ id: identity.id, kind: identity.kind, name: identity.name, role: null, ready: false });

/** PRAC-1: any player or guest opens a room; they are its first player. */
async function createPractice(identity, themeSlug = DEFAULT_THEME) {
  const { theme } = await loadThemeContent(themeSlug);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const room = await Attempt.create({
        practiceCode: generateCode(CODE_LENGTH),
        themeSlug: theme.slug,
        theme,
        timerMinutes: theme.timerMinutes,
        status: 'lobby',
        players: [asPlayer(identity)],
        lastActivityAt: new Date(),
      });
      return { code: room.practiceCode };
    } catch (err) {
      if (err.code !== 11000) throw err; // retry only a code collision
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not generate a room code');
}

/** Checks the code's shape before it reaches the database (NFR-5). */
function cleanCode(code) {
  if (typeof code !== 'string' || !patterns.PRACTICE_CODE.test(code)) throw notFound();
  return code.toUpperCase();
}

async function findPractice(code) {
  const room = await Attempt.findOne({ practiceCode: cleanCode(code) });
  if (!room) throw notFound();
  return room;
}

async function getPracticePreview(code, identity) {
  const room = await findPractice(code);
  const theme = themeOf(room);
  return {
    code: room.practiceCode,
    status: room.status,
    theme: { slug: theme.slug, name: theme.name, story: theme.story, timerMinutes: room.timerMinutes, roles: theme.roles },
    players: room.players.map((p) => ({ name: p.name, role: p.role || null })),
    isMember: room.players.some((p) => p.id === identity.id),
    full: room.players.length >= 2,
  };
}

/**
 * Takes the second seat in one atomic update, so two people racing for it can
 * never make a room of 3. A player already in the room just gets it back.
 */
async function joinPractice(code, identity) {
  const practiceCode = cleanCode(code);
  const joined = await Attempt.findOneAndUpdate(
    { practiceCode, status: 'lobby', 'players.id': { $ne: identity.id }, 'players.1': { $exists: false } },
    { $push: { players: asPlayer(identity) }, $set: { lastActivityAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (joined) return joined;

  const room = await Attempt.findOne({ practiceCode });
  if (!room) throw notFound();
  if (room.players.some((p) => p.id === identity.id)) return room;
  if (room.players.length >= 2) throw new AppError(409, 'ROOM_FULL', 'This room already has 2 players');
  throw new AppError(409, 'ALREADY_STARTED', 'This game has already started');
}

/**
 * PRAC-4 / D92: rooms idle for `idleMs` with no connected socket expire. A room never played is deleted with its
 * messages; a finished room keeps its result but releases its code. Live games are left to the pause rules (§7.6).
 * Each write repeats the idle filter, so a join racing the sweep keeps its room.
 */
async function expireIdlePractice(now, { idleMs = PRACTICE_IDLE_MS, isLive = () => false } = {}) {
  const cutoff = new Date(now - idleMs);
  const idle = {
    practiceCode: { $type: 'string' },
    $or: [{ lastActivityAt: { $lte: cutoff } }, { lastActivityAt: null, updatedAt: { $lte: cutoff } }],
  };
  const candidates = await Attempt.find({ ...idle, status: { $in: [...NEVER_PLAYED, ...Attempt.FINAL] } }, { _id: 1, status: 1 }).lean();
  let deleted = 0;
  let released = 0;
  for (const room of candidates) {
    if (isLive(String(room._id))) continue;
    if (NEVER_PLAYED.includes(room.status)) {
      const res = await Attempt.deleteOne({ _id: room._id, ...idle, status: { $in: NEVER_PLAYED } });
      if (res.deletedCount) {
        deleted += 1;
        await Message.deleteMany({ attemptId: room._id });
      }
    } else {
      const res = await Attempt.updateOne({ _id: room._id, ...idle, status: { $in: Attempt.FINAL } }, { $unset: { practiceCode: 1 } });
      if (res.modifiedCount) released += 1;
    }
  }
  return { deleted, released };
}

module.exports = {
  createPractice, findPractice, getPracticePreview, joinPractice, expireIdlePractice, PRACTICE_IDLE_MS,
};
