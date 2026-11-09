const cyberHeist = require('./cyberHeist');

// Phase 2 ships one theme with fixed values; Phase 3 replaces this with themes from the database.
const BY_SLUG = { [cyberHeist.theme.slug]: cyberHeist };

/** The theme and level set for a slug. Throws for an unknown slug (a programming error). */
function getContent(slug) {
  const content = BY_SLUG[slug];
  if (!content) throw new Error(`Unknown theme: ${slug}`);
  return content;
}

module.exports = { getContent };
