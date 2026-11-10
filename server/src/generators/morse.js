const { MORSE, morseChart } = require('../content/catalog');
const { lastLine, must } = require('./util');

/** Clue A's signals decoded letter by letter; clue B must be the standard chart. */
function solve(level) {
  must(JSON.stringify(level.clueB.data.rows) === JSON.stringify(morseChart('').rows), 'Clue B is not the Morse chart');
  const letterFor = Object.fromEntries(Object.entries(MORSE).map(([letter, code]) => [code, letter]));
  return lastLine(level.clueA).split(' ').map((code) => {
    must(letterFor[code], `Unknown signal ${code}`);
    return letterFor[code];
  }).join('');
}

module.exports = { solve };
