/** Small helpers shared by the mechanic solvers. Solvers throw on malformed clue data; the validator turns that into an error. */

const textOf = (clue) => clue.data.paragraphs.join(' ');
const lastLine = (clue) => clue.data.paragraphs[clue.data.paragraphs.length - 1];

/** Throws `message` unless `condition` holds. */
function must(condition, message) {
  if (!condition) throw new Error(message);
}

/** Minutes since midnight for '11:20 PM' or '11:35'. 12:00 AM counts as 24:00 (midnight closes the evening). */
function minutesOf(time) {
  const match = String(time).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  must(match, `Not a time: ${time}`);
  const [, h, m, half] = match;
  let hours = Number(h) % 12;
  if (half === 'PM') hours += 12;
  if (half === 'AM' && Number(h) === 12) hours = 24;
  return (half ? hours : Number(h)) * 60 + Number(m);
}

module.exports = { textOf, lastLine, must, minutesOf };
