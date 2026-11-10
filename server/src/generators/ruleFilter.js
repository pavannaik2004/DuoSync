const { must, minutesOf } = require('./util');

const TESTS = {
  eq: (cell, { value }) => cell === value,
  ne: (cell, { value }) => cell !== value,
  lt: (cell, { value }) => Number(cell) < Number(value),
  in: (cell, { value }) => value.includes(cell),
  covers: (cell, cond, row) => {
    const [from, until] = cond.cols;
    const at = minutesOf(cond.value);
    return minutesOf(row[from]) <= at && at <= minutesOf(row[until]);
  },
};

/** Filters one table by `solution.where` and picks a column: one row, or ≥ 2 rows joined with dashes. */
function solve(level) {
  const s = level.solution;
  must(s && (s.table === 'A' || s.table === 'B'), 'rule-filter needs a solution with a table');
  const clue = s.table === 'A' ? level.clueA : level.clueB;
  must(clue.type === 'table', 'The rule-filter table is missing');
  const rows = clue.data.rows.filter((row) => s.where.every((cond) => {
    must(TESTS[cond.op], `Unknown op ${cond.op}`);
    return TESTS[cond.op](row[cond.col], cond, row);
  }));
  const picked = rows.map((row) => row[s.pick]);
  if (!s.join) {
    must(picked.length === 1, `Expected exactly 1 matching row, got ${picked.length}`);
    return picked[0];
  }
  must(picked.length >= 2, `Expected at least 2 matching rows, got ${picked.length}`);
  if (s.sort) picked.sort((a, b) => (s.sort === 'asc' ? 1 : -1) * (Number(a) - Number(b)));
  return picked.join('-');
}

module.exports = { solve };
