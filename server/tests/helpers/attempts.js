const mongoose = require('mongoose');
const Attempt = require('../../src/models/Attempt');
const Challenge = require('../../src/models/Challenge');
const Team = require('../../src/models/Team');
const { getContent } = require('../../src/content');

const T = Date.UTC(2026, 10, 12, 10, 0, 0);
const MIN = 60000;

/** A started Cyber Heist practice-shaped attempt written straight to the DB: level 1 unlocked at T, 15-minute timer. */
function startedAttemptDoc(over = {}) {
  const { theme, levels } = getContent('cyber-heist');
  return Attempt.create({
    themeSlug: theme.slug,
    theme,
    players: [{ id: 'p1', kind: 'user', name: 'alice', role: 'A' }, { id: 'p2', kind: 'user', name: 'bob', role: 'B' }],
    status: 'in_progress',
    levels: levels.map((l, i) => ({ ...l, unlockedAt: i === 0 ? new Date(T) : null })),
    startedAt: new Date(T),
    endsAt: new Date(T + 15 * MIN),
    ...over,
  });
}

const HOUR = 60 * MIN;
let codeSeq = 0;

/** A Cyber Heist challenge written straight to the DB, open from an hour ago for two hours. */
function challengeDoc(over = {}) {
  const { theme, levels } = getContent('cyber-heist');
  const now = Date.now();
  codeSeq += 1;
  return Challenge.create({
    code: `LB${[...String(codeSeq).padStart(4, '0')].map((d) => 'ABCDEFGHJK'[d]).join('')}`,
    name: 'Leaderboard Test',
    themeSlug: theme.slug,
    theme,
    creatorId: new mongoose.Types.ObjectId(),
    visibility: 'private',
    startsAt: new Date(now - HOUR),
    endsAt: new Date(now + HOUR),
    seed: 'seed',
    levels,
    ...over,
  });
}

/**
 * A team (2 fresh member ids unless given) and its attempt in `challenge`, with the given status and
 * result fields: { totalPoints, levelsCleared, timeUsedMs, finishedAt, stars, ... }.
 */
async function entryDoc(challenge, teamName, fields = {}, { memberIds } = {}) {
  const members = memberIds || [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const team = await Team.create({ name: teamName, captainId: members[0], memberIds: members });
  const attempt = await Attempt.create({
    challengeId: challenge._id,
    teamId: team._id,
    memberIds: members,
    players: members.map((id, i) => ({ id: String(id), kind: 'user', name: `${teamName.replace(/\W/g, '')}${i}`, role: i ? 'B' : 'A' })),
    themeSlug: challenge.themeSlug,
    theme: challenge.theme,
    status: 'finished',
    ...fields,
  });
  return { team, attempt };
}

module.exports = { startedAttemptDoc, challengeDoc, entryDoc, T, MIN, HOUR };
