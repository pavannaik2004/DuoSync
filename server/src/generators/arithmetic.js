const { textOf, must } = require('./util');

/** reading + delta. Clue A must show the reading and clue B the size of the correction. 'clock' answers are 12-hour HHMM. */
function solve(level) {
  const s = level.solution;
  must(s && typeof s.reading === 'string' && Number.isInteger(s.delta), 'arithmetic needs a solution');
  must(textOf(level.clueA).includes(s.reading), 'Clue A does not show the reading');
  must(textOf(level.clueB).includes(String(Math.abs(s.delta))), 'Clue B does not show the correction');
  if (s.format === 'number') return String(Number(s.reading) + s.delta);
  must(s.format === 'clock', `Unknown format ${s.format}`);
  const match = s.reading.match(/^(\d{1,2}):(\d{2})$/);
  must(match, 'Not a clock reading');
  const total = ((((Number(match[1]) % 12) * 60 + Number(match[2]) + s.delta) % 720) + 720) % 720;
  const hours = Math.floor(total / 60) || 12;
  return `${String(hours).padStart(2, '0')}${String(total % 60).padStart(2, '0')}`;
}

module.exports = { solve };
