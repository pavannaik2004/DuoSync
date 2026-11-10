const { textOf, must } = require('./util');

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

module.exports = { solve };
