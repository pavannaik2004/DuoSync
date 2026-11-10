/**
 * Shared vocabulary for theme content (docs/themed-puzzle-sets.md). Generators (Phase 3),
 * the admin panel (Phase 5) and the content tests all check against these lists.
 */

/** The 11 mechanics of PRD §6.2. Each one gets a generator in `generators/<mechanic>.js`. */
const MECHANICS = [
  'decode-key',
  'caesar',
  'rule-filter',
  'describe-match',
  'ordering',
  'grid-lookup',
  'grid-navigation',
  'morse',
  'split-riddle',
  'arithmetic',
  'fragment-finale',
];

/** The 6 clue display types of PRD §6.3. */
const CLUE_TYPES = ['text', 'tokens', 'symbols', 'table', 'grid', 'strip'];

/**
 * The built-in icon set for `symbols` clues. The first 6 are drawn today (client Glyph.jsx);
 * the other 10 arrive with Phase 3. Letter legends need up to 6 letters plus 2 decoys.
 */
const SYMBOL_SHAPES = [
  'triangle', 'circle', 'square', 'diamond', 'hexagon', 'star',
  'moon', 'cross', 'heart', 'wave', 'eye', 'key', 'crown', 'sun', 'anchor', 'bolt',
];

/** Chip colours for `tokens` clues. The name is always printed next to the swatch (NFR-16). */
const TOKEN_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'];

/** One visual style per theme (UI-2). Palettes and fonts are in the Themed Puzzle Sets document. */
const STYLE_KEYS = ['cyber', 'noir', 'orbital', 'pirate', 'haunted', 'tomb', 'arcane', 'polar'];

/** What a solved level adds to the team board (GAME-8). */
const REWARD_RULES = ['letter', 'digit', 'answer', 'caseNote'];

/** International Morse code, letters and digits. */
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

/** Morse for a word: letters separated by single spaces. */
const toMorse = (word) => [...word].map((ch) => MORSE[ch]).join(' ');

/** The Morse chart as a `table` clue's data (Role B's half of every Morse level). */
const morseChart = (caption) => ({
  caption,
  columns: ['Letter', 'Signal'],
  rows: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => [letter, MORSE[letter]]),
});

/** Shifts each letter of `word` by `shift` places (negative = back). A Caesar helper for authors and tests. */
const shiftWord = (word, shift) => [...word]
  .map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + shift + 26 * 4) % 26) + 65))
  .join('');

module.exports = {
  MECHANICS, CLUE_TYPES, SYMBOL_SHAPES, TOKEN_COLORS, STYLE_KEYS, REWARD_RULES, MORSE, toMorse, morseChart, shiftWord,
};
