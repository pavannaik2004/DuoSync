const { must } = require('./util');

/** Sorts the ids of a table by its value column. Ids are joined as one code, or with dashes for a list answer. */
function solve(level) {
  const s = level.solution;
  must(s && s.table === 'A' && (s.direction === 'asc' || s.direction === 'desc'), 'ordering needs a solution');
  must(level.clueA.type === 'table', 'The ordering table is missing');
  const sign = s.direction === 'asc' ? 1 : -1;
  const ids = [...level.clueA.data.rows]
    .sort((a, b) => sign * (Number(a[s.valueCol]) - Number(b[s.valueCol])))
    .map((row) => row[s.idCol]);
  return ids.join(level.answerKind === 'list' ? '-' : '');
}

module.exports = { solve };
