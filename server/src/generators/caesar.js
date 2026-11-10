const { shiftWord } = require('../content/catalog');
const { lastLine, must } = require('./util');

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

module.exports = { solve };
