const { textOf, must } = require('./util');
const { attempt, fill, leaks, squash } = require('./pick');

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

const entriesOf = (pool) => (pool || []).map((entry) => (typeof entry === 'string' ? entry : entry.answer));

/** Every ordering of `items`. */
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

const clueAParagraphs = (copy, titles) => [copy.introA, `${titles.join(', ')}.`];

/**
 * D53: fixes, before level 1 is generated, what levels 1-4 reward and the order the finale reads them in.
 * - 'letters': a word from the pool, one letter per level, in finale order.
 * - 'distinct digits': four different digits 1-9.
 * - 'answers' (Pirate): a word whose letters are the first letters of the levels' answers; `startsWith` tells each
 *   level's generator which first letter to pick, and only letters the level's pool can supply are used.
 * Returns { rewards: {order: string}, startsWith: {order: letter}, order: number[], answer: string }; Detective has no
 * fragment finale, so its plan is empty.
 */
function plan({ templates, params, pools, rng }) {
  const empty = { rewards: {}, startsWith: {}, order: [], answer: '' };
  if (!params || !params.rewards) return empty;
  const earlier = templates.filter((t) => t.mechanic !== 'fragment-finale').sort((a, b) => a.order - b.order);
  const orders = earlier.map((t) => t.order);
  const titleOf = Object.fromEntries(earlier.map((t) => [t.order, t.title]));
  const copy = params.copy || {};

  if (params.rewards.includes('digit')) {
    const digits = rng.sample(['1', '2', '3', '4', '5', '6', '7', '8', '9'], orders.length);
    const rewards = Object.fromEntries(orders.map((o, i) => [o, digits[i]]));
    const order = rng.shuffle(orders);
    return { rewards, startsWith: {}, order, answer: order.map((o) => rewards[o]).join('') };
  }

  const firstLetters = (order) => new Set(entriesOf(pools[earlier.find((t) => t.order === order).params.pool]).map((w) => w[0].toUpperCase()));
  const supply = params.rewards === 'answers' ? Object.fromEntries(orders.map((o) => [o, firstLetters(o)])) : null;
  // A password that is itself a level answer would show in clue B (D49), so those words are left out.
  const answers = new Set(supply ? earlier.flatMap((t) => entriesOf(pools[t.params.pool]).map((w) => w.toUpperCase())) : []);
  const words = (pools[params.pool] || []).filter((w) => w.length === orders.length && !answers.has(w));
  // Try finale orders and words in a random order until one fits; a word may not show in the fixed text (D49).
  for (const order of rng.shuffle(permutations(orders))) {
    const shown = squash([JSON.stringify(copy), ...clueAParagraphs(copy, order.map((o) => titleOf[o]))].join(' '));
    const word = rng.shuffle(words).find((w) => !shown.includes(squash(w)) && (!supply || [...w].every((ch, i) => supply[order[i]].has(ch))));
    if (!word) continue;
    const letters = Object.fromEntries(order.map((o, i) => [o, word[i]]));
    return supply
      ? { rewards: {}, startsWith: letters, order, answer: word }
      : { rewards: letters, startsWith: {}, order, answer: word };
  }
  throw new Error('The finale plan has no usable word');
}

/** Clue A lists the titles in plan order; clue B lists each level's reward (or answer) in shuffled order. */
function generate({ template, params, rng, context }) {
  const { copy } = params;
  const firstLetter = params.use === 'firstLetter';
  const digits = params.rewards.includes('digit');
  const earlier = context.levels.slice(0, 4);
  const byOrder = Object.fromEntries(earlier.map((l) => [l.order, l]));
  const sequence = context.plan.order.map((o) => byOrder[o]);
  must(sequence.every(Boolean), 'The finale plan names a level that was not generated');
  const answer = sequence.map((l) => (firstLetter ? l.reward[0] : l.reward)).join('');
  must(context.plan.answer === undefined || context.plan.answer === answer, 'The finale answer differs from the plan');
  const clueA = { type: 'text', data: { paragraphs: clueAParagraphs(copy, sequence.map((l) => l.title)) } };
  return attempt('fragment-finale', () => {
    const entries = rng.shuffle(earlier).map((l) => fill(copy.entry, { title: l.title, value: l.reward }));
    const clueB = { type: 'text', data: { paragraphs: [copy.introB, entries.join(' ')] } };
    if (leaks(template, answer, digits ? 'code' : 'word', clueA, clueB)) return null;
    const explanation = firstLetter
      ? `${sequence.map((l) => l.reward).join(', ')}: the first letters spell ${answer}.`
      : `${sequence.map((l) => l.reward).join(', ')} in that order ${digits ? 'make' : 'spells'} ${answer}.`;
    return { clueA, clueB, answer, acceptedAnswers: [], answerKind: digits ? 'code' : 'word', reward: null, explanation };
  });
}

module.exports = { solve, plan, generate };
