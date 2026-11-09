const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const patterns = require('../utils/patterns');
const { generateCode } = require('./codeService');
const { getContent } = require('../content');

const CODE_LENGTH = 6; // PRAC-1
const THEME = 'cyber-heist'; // Phase 2 plays Cyber Heist only

const notFound = () => new AppError(404, 'PRACTICE_NOT_FOUND', 'No practice room has that code');
const asPlayer = (identity) => ({ id: identity.id, kind: identity.kind, name: identity.name, role: null, ready: false });

/** PRAC-1: any player or guest opens a room; they are its first player. */
async function createPractice(identity) {
  const { theme } = getContent(THEME);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const room = await Attempt.create({
        practiceCode: generateCode(CODE_LENGTH),
        themeSlug: theme.slug,
        timerMinutes: theme.timerMinutes,
        status: 'lobby',
        players: [asPlayer(identity)],
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
  const { theme } = getContent(room.themeSlug);
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
    { $push: { players: asPlayer(identity) } },
    { returnDocument: 'after' },
  );
  if (joined) return joined;

  const room = await Attempt.findOne({ practiceCode });
  if (!room) throw notFound();
  if (room.players.some((p) => p.id === identity.id)) return room;
  if (room.players.length >= 2) throw new AppError(409, 'ROOM_FULL', 'This room already has 2 players');
  throw new AppError(409, 'ALREADY_STARTED', 'This game has already started');
}

module.exports = { createPractice, findPractice, getPracticePreview, joinPractice };
