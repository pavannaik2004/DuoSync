const { textOf, must } = require('./util');

/** The pool riddle whose two halves are clue A and clue B. */
function solve(level, context = {}) {
  const riddles = (context.pools && context.pools.riddles) || [];
  const riddle = riddles.find((r) => textOf(level.clueA).includes(r.partA) && textOf(level.clueB).includes(r.partB));
  must(riddle, 'No pool riddle matches the two halves');
  must(JSON.stringify(level.acceptedAnswers) === JSON.stringify(riddle.acceptedAnswers), 'Accepted answers differ from the riddle');
  return riddle.answer;
}

module.exports = { solve };
