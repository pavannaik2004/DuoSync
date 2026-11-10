const { shiftWord } = require('../content/catalog');
const { lastLine, must } = require('./util');
const { buildLevel, fill, fixedText, pickAnswer } = require('./pick');

/** The word in clue A's last line, shifted by the strip's shift or, for a numbered strip, by an earlier answer. */
function solve(level, context = {}) {
  const strip = level.clueB.data;
  let shift;
  let direction;
  if (strip.numbered) {
    const carry = context.params && context.params.carryOver;
    must(carry && Number.isInteger(carry.shiftFrom), 'A numbered strip needs params.carryOver.shiftFrom');
    const source = (context.levels || [])[carry.shiftFrom - 1];
    must(source, `Level ${carry.shiftFrom} is not available`);
    shift = Number(source.answer);
    direction = context.params.direction;
  } else {
    ({ shift, direction } = strip);
  }
  must(Number.isInteger(shift) && shift >= 1 && shift <= 25, 'No usable shift');
  must(direction === 'back' || direction === 'forward', 'No direction');
  return shiftWord(lastLine(level.clueA), direction === 'back' ? -shift : shift);
}

/**
 * Clue A is the answer word shifted the opposite way to the strip. A numbered strip (Detective) takes its shift
 * from an earlier answer and its word from the suspects of another level that were not cleared.
 */
function generate({ template, params, pools, rng, context }) {
  const { copy, direction } = params;
  let word;
  let shift;
  let strip;
  if (params.carryOver) {
    const { shiftFrom, suspectsFrom } = params.carryOver;
    const source = context.levels[shiftFrom - 1];
    const suspectsLevel = context.levels[suspectsFrom - 1];
    must(source && suspectsLevel, 'The earlier levels are not available');
    shift = Number(source.answer);
    const suspects = suspectsLevel.clueA.data.rows.map((row) => row[0]).filter((name) => name !== suspectsLevel.answer);
    word = pickAnswer(suspects, rng, context, template.order, fixedText(template));
    strip = { caption: copy.stripCaption, numbered: true };
  } else {
    shift = rng.int(params.shift[0], params.shift[1]);
    word = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
    strip = { caption: fill(copy.stripCaption, { shift, places: shift === 1 ? 'place' : 'places' }), shift, direction };
  }
  const encoded = shiftWord(word, direction === 'back' ? shift : -shift);
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer: word,
    clueA: { type: 'text', data: { paragraphs: [copy.introA, encoded] } },
    clueB: { type: 'strip', data: strip },
    explanation: `${encoded} shifted ${direction} by ${shift} is ${word}.`,
  });
}

module.exports = { solve, generate };
