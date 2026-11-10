const { textOf, must } = require('./util');
const { buildLevel, fixedText, pickAnswer } = require('./pick');

/** The pool riddle whose two halves are clue A and clue B. */
function solve(level, context = {}) {
  const riddles = (context.pools && context.pools.riddles) || [];
  const riddle = riddles.find((r) => textOf(level.clueA).includes(r.partA) && textOf(level.clueB).includes(r.partB));
  must(riddle, 'No pool riddle matches the two halves');
  must(JSON.stringify(level.acceptedAnswers) === JSON.stringify(riddle.acceptedAnswers), 'Accepted answers differ from the riddle');
  return riddle.answer;
}

/** A pool riddle cut in two: the first half for Role A, the second for Role B. */
function generate({ template, params, pools, rng, context }) {
  const riddle = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
  const { copy } = params;
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer: riddle.answer,
    acceptedAnswers: [...riddle.acceptedAnswers],
    clueA: { type: 'text', data: { paragraphs: [copy.introA, riddle.partA] } },
    clueB: { type: 'text', data: { paragraphs: [copy.introB, riddle.partB] } },
    explanation: `Both halves together describe ${riddle.answer}.`,
  });
}

module.exports = { solve, generate };
