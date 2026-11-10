const { must } = require('./util');
const { buildLevel, distinctInts, fill, spells } = require('./pick');

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

/** Distinct ids with distinct values (so no ties); Role B says which way to sort. The table never starts in answer order. */
function generate({ template, params, rng, context }) {
  const { copy } = params;
  const [lo, hi] = params.valueRange;
  const direction = rng.pick(params.direction);
  const words = params.directionWords[direction];
  const sign = direction === 'asc' ? 1 : -1;
  let rows;
  let answer;
  for (let tries = 0; tries < 50; tries += 1) {
    const ids = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], params.items);
    const values = distinctInts(rng, lo, hi, params.items);
    rows = ids.map((id, i) => [String(id), String(values[i])]);
    const sorted = [...rows].sort((a, b) => sign * (Number(a[1]) - Number(b[1])));
    if (sorted.every((row, i) => row === rows[i])) rows.reverse();
    answer = sorted.map((row) => row[0]).join('');
    // Ids and values sit side by side in the JSON, so a run like 5 | 214 could spell the answer 5214.
    if (!spells({ data: { rows } }, answer)) break;
  }
  const rest = template.fallback.clueB.data.paragraphs.slice(1);
  return buildLevel({
    template,
    context,
    answerKind: 'code',
    answer,
    clueA: { type: 'table', data: { caption: copy.captionA, columns: copy.columns, rows } },
    clueB: { type: 'text', data: { paragraphs: [fill(copy.ruleLine, { direction: words }), ...rest] } },
    solution: { table: 'A', idCol: 0, valueCol: 1, direction },
    explanation: `Ordered ${words}, the ids read ${answer}.`,
  });
}

module.exports = { solve, generate };
