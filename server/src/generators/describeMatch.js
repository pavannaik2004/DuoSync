const { SYMBOL_SHAPES } = require('../content/catalog');
const { textOf, must } = require('./util');
const { attempt, buildLevel, fallbackCaption, fixedText, leaks, pickAnswer } = require('./pick');

/** Symbols: each of clue A's shapes through clue B's legend. Weapon variant: the pool weapon whose wound is clue A's text. */
function solve(level, context = {}) {
  if (level.clueA.type === 'symbols') {
    must(level.clueB.type === 'symbols', 'The legend must be a symbols clue');
    const legend = {};
    for (const s of level.clueB.data.symbols) {
      must(!(s.shape in legend), `Duplicate legend shape ${s.shape}`);
      legend[s.shape] = s.label;
    }
    const decoys = level.clueB.data.symbols.filter((s) => !level.clueA.data.symbols.some((a) => a.shape === s.shape));
    must(decoys.length >= 1, 'The legend needs at least one decoy');
    return level.clueA.data.symbols.map((s) => {
      must(legend[s.shape] !== undefined, `No legend entry for ${s.shape}`);
      return legend[s.shape];
    }).join('');
  }
  const weapons = (context.pools && context.pools.weapons) || [];
  const weapon = weapons.find((w) => w.wound === textOf(level.clueA));
  must(weapon, "Clue A is not a pool weapon's wound");
  return weapon.name;
}

const caption = (template, copy, half) => (copy && copy[`caption${half}`]) || fallbackCaption(template, half);
const symbolClues = (template, copy, shown, legend) => ({
  clueA: { type: 'symbols', data: { caption: caption(template, copy, 'A'), symbols: shown.map((shape) => ({ shape })) } },
  clueB: { type: 'symbols', data: { caption: caption(template, copy, 'B'), symbols: legend.map(([shape, label]) => ({ shape, label })) } },
});

/** Cyber 4: 4 distinct shapes from the first 6, each with its own digit, plus 1-2 decoy glyphs in the legend. */
function glyphDigits({ template, params, rng, context }) {
  const { copy } = params;
  const decoys = rng.int(params.decoys[0], params.decoys[1]);
  return attempt('glyph-digits', () => {
    const shapes = rng.sample(params.shapesFrom, params.length + decoys);
    const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], shapes.length).map(String);
    const shown = shapes.slice(0, params.length);
    const answer = digits.slice(0, params.length).join('');
    const { clueA, clueB } = symbolClues(template, copy, shown, rng.shuffle(shapes.map((shape, i) => [shape, digits[i]])));
    if (leaks(template, answer, 'code', clueA, clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'code',
      answer,
      clueA,
      clueB,
      explanation: `${shown.map((shape, i) => `${shape} ${digits[i]}`).join(', ')} gives ${answer}.`,
    });
  });
}

/** Pirate 3 and Tomb 1: a pool word spelled in glyphs; one shape per distinct letter, plus decoy letters in the legend. */
function glyphLetters({ template, params, pools, rng, context }) {
  const { copy } = params;
  const word = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
  const letters = [...new Set(word)];
  const spare = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((letter) => !letters.includes(letter));
  const entries = [...letters, ...rng.sample(spare, params.decoys)];
  must(entries.length <= SYMBOL_SHAPES.length, `${word} needs more glyphs than there are shapes`);
  return attempt('glyph-letters', () => {
    const shapes = rng.sample(SYMBOL_SHAPES, entries.length);
    const shapeOf = Object.fromEntries(entries.map((letter, i) => [letter, shapes[i]]));
    const { clueA, clueB } = symbolClues(
      template,
      copy,
      [...word].map((letter) => shapeOf[letter]),
      rng.shuffle(entries.map((letter) => [shapeOf[letter], letter])),
    );
    // A shape named like the word (the ANCHOR glyph in ANCHOR) would spell the answer in the clue data.
    if (leaks(template, word, 'word', clueA, clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'word',
      answer: word,
      clueA,
      clueB,
      explanation: `${[...word].map((letter) => `${shapeOf[letter]} ${letter}`).join(', ')} spells ${word}.`,
    });
  });
}

/** Detective 4: a weapon's wound in clue A; clue B is the register listing all five weapons and their marks. */
function weapon({ template, params, pools, rng, context }) {
  const { copy } = params;
  const list = pools[params.pool];
  const name = pickAnswer(list.map((w) => w.name), rng, context, template.order, fixedText(template));
  const chosen = list.find((w) => w.name === name);
  const marks = list.map((w) => w.mark);
  must(new Set(list.map((w) => w.name)).size === list.length && marks.filter((m) => m === chosen.mark).length === 1,
    'The weapons register needs unique names and a unique mark for the chosen weapon');
  must(list.length === params.shown, `The register shows ${params.shown} weapons`);
  const rows = rng.shuffle(list).map((w) => [w.name, w.mark]);
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer: name,
    clueA: { type: 'text', data: { paragraphs: [chosen.wound] } },
    clueB: {
      type: 'table',
      data: { caption: caption(template, copy, 'B'), columns: template.fallback.clueB.data.columns, rows },
    },
    explanation: `${chosen.wound} matches the register entry for the ${name}.`,
  });
}

const VARIANTS = { 'glyph-digits': glyphDigits, 'glyph-letters': glyphLetters, weapon };

/** Builds the level for `params.variant`; solve() re-derives the answer from the generated clues. */
function generate(args) {
  const build = VARIANTS[args.params.variant];
  must(build, `Unknown describe-match variant ${args.params.variant}`);
  return build(args);
}

module.exports = { solve, generate };
