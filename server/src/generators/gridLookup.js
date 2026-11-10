const { must } = require('./util');
const { buildLevel } = require('./pick');

/** Column letters skip I and O (easy to confuse with 1 and 0). */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
const DIGITS = '123456789'.split('');

/** The marked cell of clue A, read through clue B's column and row labels: column label then row label. */
function solve(level) {
  const marked = level.clueA.data.cells.filter((c) => c.mark);
  must(marked.length === 1, 'Exactly one cell must be marked');
  must(level.clueA.data.colLabels === undefined, 'Clue A must not carry the labels');
  const { colLabels, rowLabels } = level.clueB.data;
  must(colLabels && rowLabels, 'Clue B needs column and row labels');
  return colLabels[marked[0].c] + rowLabels[marked[0].r];
}

/** One marked cell for Role A; Role B holds the distinct column letters and row digits. */
function generate({ template, params, rng, context }) {
  const { rows, cols, copy } = params;
  const colLabels = rng.sample(LETTERS, cols);
  const rowLabels = rng.sample(DIGITS, rows);
  const r = rng.int(0, rows - 1);
  const c = rng.int(0, cols - 1);
  const answer = colLabels[c] + rowLabels[r];
  return buildLevel({
    template,
    context,
    answerKind: 'code',
    answer,
    clueA: { type: 'grid', data: { caption: copy.captionA, rows, cols, cells: [{ r, c, mark: params.mark }] } },
    clueB: { type: 'grid', data: { caption: copy.captionB, rows, cols, colLabels, rowLabels, cells: [] } },
    explanation: `The marked cell is in column ${colLabels[c]} and row ${rowLabels[r]}: ${answer}.`,
  });
}

module.exports = { solve, generate };
