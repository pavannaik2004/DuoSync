const { textOf, must } = require('./util');
const { buildLevel, fill, fixedText, pickAnswer } = require('./pick');

const MOVES = { north: [-1, 0], south: [1, 0], east: [0, 1], west: [0, -1] };

/** Starts on a named cell of clue B's map and follows exactly 3 moves from clue A, staying on the map. */
function solve(level) {
  const map = level.clueB.data;
  const text = textOf(level.clueA);
  const startMatch = text.match(/Start (?:at|on) the ([A-Z]+)/);
  must(startMatch, 'No start in the directions');
  const start = map.cells.find((cell) => cell.label === startMatch[1]);
  must(start, `${startMatch[1]} is not on the map`);
  let { r, c } = start;
  const moves = [...text.matchAll(/(\d+) (?:paces?|steps?|tiles?) (north|south|east|west)/g)];
  must(moves.length === 3, 'Expected exactly 3 moves');
  for (const [, count, dir] of moves) {
    for (let i = 0; i < Number(count); i += 1) {
      r += MOVES[dir][0];
      c += MOVES[dir][1];
      must(r >= 0 && r < map.rows && c >= 0 && c < map.cols, 'The route leaves the map');
    }
  }
  const end = map.cells.find((cell) => cell.r === r && cell.c === c);
  must(end && end.label, 'The route ends on an empty cell');
  return end.label;
}

/** A random walk of `params.moves` legs of 1-3 squares that stays on the map and never revisits a square. */
function randomRoute(rng, rows, cols, legs) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const start = { r: rng.int(0, rows - 1), c: rng.int(0, cols - 1) };
    const seen = new Set([`${start.r},${start.c}`]);
    const moves = [];
    let { r, c } = start;
    let ok = true;
    for (let leg = 0; leg < legs && ok; leg += 1) {
      const dir = rng.pick(Object.keys(MOVES));
      const count = rng.int(1, 3);
      moves.push({ dir, count });
      for (let i = 0; i < count && ok; i += 1) {
        r += MOVES[dir][0];
        c += MOVES[dir][1];
        const key = `${r},${c}`;
        ok = r >= 0 && r < rows && c >= 0 && c < cols && !seen.has(key);
        seen.add(key);
      }
    }
    if (ok) return { start, end: { r, c }, moves, path: seen };
  }
  throw new Error('No route fits on the map');
}

/**
 * Builds the route first, then labels the start square and the end square (the answer) and scatters the other
 * landmarks on squares the route never touches, so the walk passes no landmark.
 */
function generate({ template, params, pools, rng, context }) {
  const { rows, cols, copy } = params;
  const pool = pools[params.pool];
  const route = randomRoute(rng, rows, cols, params.moves);
  const answer = pickAnswer(pool, rng, context, template.order, fixedText(template));
  const [startLabel, ...others] = rng.sample(pool.filter((label) => label !== answer), params.landmarks - 1);
  const free = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) if (!route.path.has(`${r},${c}`)) free.push({ r, c });
  }
  const cells = [
    { ...route.start, label: startLabel },
    { ...route.end, label: answer },
    ...rng.sample(free, others.length).map((cell, i) => ({ ...cell, label: others[i] })),
  ].sort((a, b) => a.r - b.r || a.c - b.c);
  const [singular, plural] = params.unit;
  const lines = route.moves.map(({ dir, count }) => fill(copy.moveLine, { count, unit: count === 1 ? singular : plural, direction: dir }));
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer,
    clueA: { type: 'text', data: { paragraphs: [copy.introA, fill(copy.startLine, { landmark: startLabel }), ...lines] } },
    clueB: { type: 'grid', data: { caption: template.fallback.clueB.data.caption, rows, cols, cells } },
    explanation: `From the ${startLabel}: ${route.moves.map(({ dir, count }) => `${count} ${dir}`).join(', ')} lands on ${answer}.`,
  });
}

module.exports = { solve, generate };
