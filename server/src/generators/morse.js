const { MORSE, morseChart, toMorse } = require('../content/catalog');
const { lastLine, must } = require('./util');
const { buildLevel, fallbackCaption, fixedText, pickAnswer } = require('./pick');

/** Clue A's signals decoded letter by letter; clue B must be the standard chart. */
function solve(level) {
  must(JSON.stringify(level.clueB.data.rows) === JSON.stringify(morseChart('').rows), 'Clue B is not the Morse chart');
  const letterFor = Object.fromEntries(Object.entries(MORSE).map(([letter, code]) => [code, letter]));
  return lastLine(level.clueA).split(' ').map((code) => {
    must(letterFor[code], `Unknown signal ${code}`);
    return letterFor[code];
  }).join('');
}

/** A pool word as signals for Role A; Role B holds the chart. */
function generate({ template, params, pools, rng, context }) {
  const word = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer: word,
    clueA: { type: 'text', data: { paragraphs: [params.copy.introA, toMorse(word)] } },
    clueB: { type: 'table', data: morseChart(fallbackCaption(template, 'B')) },
    explanation: `Reading each signal through the chart spells ${word}.`,
  });
}

module.exports = { solve, generate };
