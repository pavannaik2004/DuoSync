const { textOf, must } = require('./util');

/** Clue A names the four earlier levels in order; the answer joins their rewards (or first letters). */
function solve(level, context = {}) {
  const earlier = (context.levels || []).slice(0, 4);
  must(earlier.length === 4, 'The finale needs levels 1-4');
  const firstLetter = context.params && context.params.use === 'firstLetter';
  const text = textOf(level.clueA);
  const ordered = earlier.filter((p) => text.includes(p.title)).sort((a, b) => text.indexOf(a.title) - text.indexOf(b.title));
  must(ordered.length === 4, 'Clue A must name all four level titles');
  const listing = textOf(level.clueB);
  for (const p of earlier) must(listing.includes(`${p.title}${firstLetter ? ':' : ''}`), `Clue B does not list ${p.title}`);
  return ordered.map((p) => (firstLetter ? p.reward[0] : p.reward)).join('');
}

module.exports = { solve };
