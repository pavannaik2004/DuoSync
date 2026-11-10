const { must } = require('./util');

/** The marked cell of clue A, read through clue B's column and row labels: column label then row label. */
function solve(level) {
  const marked = level.clueA.data.cells.filter((c) => c.mark);
  must(marked.length === 1, 'Exactly one cell must be marked');
  must(level.clueA.data.colLabels === undefined, 'Clue A must not carry the labels');
  const { colLabels, rowLabels } = level.clueB.data;
  must(colLabels && rowLabels, 'Clue B needs column and row labels');
  return colLabels[marked[0].c] + rowLabels[marked[0].r];
}

module.exports = { solve };
