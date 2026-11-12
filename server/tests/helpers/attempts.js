const Attempt = require('../../src/models/Attempt');
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

module.exports = { startedAttemptDoc, T, MIN };
