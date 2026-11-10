const { must, minutesOf } = require('./util');
const { attempt, buildLevel, fallbackCaption, fill, fixedText, leaks, pickAnswer } = require('./pick');

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

const columnsOf = (template, half) => template.fallback[half === 'A' ? 'clueA' : 'clueB'].data.columns;
const table = (template, half, copy, rows) => ({
  type: 'table',
  data: { caption: copy[`caption${half}`] || fallbackCaption(template, half), columns: columnsOf(template, half), rows },
});
const text = (...paragraphs) => ({ type: 'text', data: { paragraphs } });
const byNumber = (dir) => (a, b) => (dir === 'asc' ? 1 : -1) * (Number(a) - Number(b));
/** The ids that match, sorted numerically the way the player must enter them. */
const listAnswer = (ids, dir) => [...ids].sort(byNumber(dir)).join('-');
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const pad2 = (n) => String(n).padStart(2, '0');

/** '11:20 PM'-style label for minutes since midnight (1440 is midnight at the end of the evening). */
function clockLabel(minutes) {
  const hours = Math.floor(minutes / 60) % 24;
  return `${hours % 12 || 12}:${pad2(minutes % 60)} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** Cyber 3: 6 servers, exactly 3 offline (fan OFF and light not GREEN). */
function offlineServers({ template, params, rng, context }) {
  const { copy } = params;
  return attempt('offline-servers', () => {
    const dir = rng.pick(params.sortDirection);
    const ids = rng.sample(range(params.idRange[0], params.idRange[1]), params.items).sort((x, y) => x - y);
    const offline = new Set(rng.sample(ids, params.answerCount));
    const rows = ids.map((id) => {
      if (offline.has(id)) return [String(id), rng.pick(['RED', 'AMBER']), 'OFF'];
      // An online server has its fan ON, or its fan OFF but a GREEN light: each passes only half the rule.
      return rng.int(0, 1) ? [String(id), rng.pick(['RED', 'AMBER', 'GREEN']), 'ON'] : [String(id), 'GREEN', 'OFF'];
    });
    const answer = listAnswer(offline, dir);
    const clueA = table(template, 'A', copy, rows);
    const clueB = text(copy.ruleB, fill(copy.orderB, copy.directions[dir]));
    if (leaks(template, answer, 'list', clueA, clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'list',
      answer,
      clueA,
      clueB,
      explanation: `Servers ${[...offline].sort(byNumber('asc')).join(', ')} are offline: ${answer}.`,
      solution: { table: 'A', where: [{ col: 2, op: 'eq', value: 'OFF' }, { col: 1, op: 'ne', value: 'GREEN' }], pick: 0, sort: dir, join: true },
    });
  });
}

/** The murder time that level 1 settled on, as '11:20 PM' and minutes since midnight (the murder is always in the evening). */
function murderTime(context) {
  const first = (context.levels || [])[0];
  const match = first && /^(\d{2})(\d{2})$/.exec(String(first.answer));
  must(match && Number(match[1]) >= 6 && Number(match[1]) <= 11, 'Level 1 has no usable murder time');
  return { label: `${Number(match[1])}:${match[2]} PM`, minutes: (Number(match[1]) + 12) * 60 + Number(match[2]) };
}

/** Detective 2: 4 suspects, exactly one seen by a witness for an interval that contains the murder time. */
function alibis({ template, params, pools, rng, context }) {
  const { copy } = params;
  const { label, minutes: at } = murderTime(context);
  const cleared = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
  const others = rng.sample(pools[params.pool].filter((name) => name !== cleared), params.suspects - 1);
  const witnesses = rng.shuffle(pools.witnesses);
  const covering = () => [at - 5 * rng.int(1, 8), Math.min(1440, at + 5 * rng.int(1, 8))];
  const before = () => {
    const until = at - 5 * rng.int(1, 6);
    return [Math.max(1260, until - 5 * rng.int(2, 8)), until];
  };
  const after = () => {
    const from = at + 5 * rng.int(1, Math.max(1, Math.min(6, Math.floor((1430 - at) / 5))));
    return [from, Math.min(1440, from + 5 * rng.int(3, 9))];
  };
  const missing = () => (rng.int(0, 1) ? before() : after());
  const entries = [{ name: cleared, witness: witnesses[0], interval: covering() }];
  others.forEach((name, i) => {
    // The first decoy has no witness but a covering interval, so an interval alone never clears anyone.
    const mode = i === 0 ? 'nobody-covers' : rng.pick(['nobody-covers', 'nobody-misses', 'witness-misses']);
    if (mode === 'nobody-covers') entries.push({ name, witness: 'nobody', interval: covering() });
    else if (mode === 'nobody-misses') entries.push({ name, witness: 'nobody', interval: missing() });
    else entries.push({ name, witness: witnesses[i + 1], interval: missing() });
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  const rows = entries.map((e) => [e.name, e.witness, clockLabel(e.interval[0]), clockLabel(e.interval[1])]);
  return buildLevel({
    template,
    context,
    answerKind: 'word',
    answer: cleared,
    clueA: table(template, 'A', copy, rows),
    clueB: text(...copy.clueB),
    explanation: `Only ${cleared} was seen by a witness (${entries.find((e) => e.name === cleared).witness}) at ${label}.`,
    solution: {
      table: 'A',
      where: [{ col: 1, op: 'ne', value: 'nobody' }, { col: 2, op: 'covers', cols: [2, 3], value: label }],
      pick: 0,
      sort: null,
      join: false,
    },
  });
}

/** Detective 3: the print length read against the fixed shoe-size chart. */
function shoeSize({ template, params, rng, context }) {
  const { copy } = params;
  const lengths = Object.keys(params.sizeChart).map(Number);
  const cm = rng.int(params.printLengthCm[0], params.printLengthCm[1]);
  must(lengths.includes(cm), 'The print length is not on the chart');
  const answer = String(params.sizeChart[cm]);
  return buildLevel({
    template,
    context,
    answerKind: 'code',
    answer,
    clueA: text(rng.pick(copy.introA), fill(rng.pick(copy.measureA), { cm })),
    clueB: table(template, 'B', copy, lengths.map((len) => [`${len} cm`, String(params.sizeChart[len])])),
    explanation: `A ${cm} cm print is shoe size ${answer} on the chart.`,
    solution: { table: 'B', where: [{ col: 0, op: 'eq', value: `${cm} cm` }], pick: 1, sort: null, join: false },
  });
}

/** Pirate 4: 5 items with a colour and a kind; the log's two-part rule fits exactly one. */
function cursedItem({ template, params, pools, rng, context }) {
  const { copy } = params;
  return attempt('cursed-item', () => {
    const target = pickAnswer(pools[params.pool], rng, context, template.order, fixedText(template));
    const names = [target, ...rng.sample(pools[params.pool].filter((n) => n !== target), params.items - 1)];
    const items = rng.shuffle(names).map((name) => ({ name, colour: rng.pick(params.colours), kind: rng.pick(params.kinds) }));
    const goal = items.find((item) => item.name === target);
    const variant = rng.pick(params.ruleVariants);
    const another = (list, value) => rng.pick(list.filter((v) => v !== value));
    const colour = variant === 'not colour+kind' ? another(params.colours, goal.colour) : goal.colour;
    const kind = variant === 'colour+not kind' ? another(params.kinds, goal.kind) : goal.kind;
    const where = [
      { col: 1, op: variant === 'not colour+kind' ? 'ne' : 'eq', value: colour },
      { col: 2, op: variant === 'colour+not kind' ? 'ne' : 'eq', value: kind },
    ];
    const hits = items.filter((item) => where.every((cond) => TESTS[cond.op](cond.col === 1 ? item.colour : item.kind, cond)));
    if (hits.length !== 1) return null;
    const clueB = text(fill(copy.clueB[0], { rule: fill(copy.rules[variant], { colour, kind }) }), copy.clueB[1]);
    if (leaks(template, target, 'word', clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'word',
      answer: target,
      clueA: table(template, 'A', copy, items.map((item) => [item.name, item.colour, item.kind])),
      clueB,
      explanation: `${target} is the only item that fits the rule (${variant}).`,
      solution: { table: 'A', where, pick: 0, sort: null, join: false },
    });
  });
}

const WINTER = ['December', 'January', 'February'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Haunted 2: six beds, exactly one admitted in winter, never discharged, by a window. */
function patientBed({ template, params, rng, context }) {
  const { copy } = params;
  const beds = rng.sample(range(1, 30), params.items).sort((a, b) => a - b);
  const target = rng.pick(beds);
  const rows = beds.map((bed) => {
    if (bed === target) return [String(bed), rng.pick(WINTER), 'No', 'Yes'];
    return attempt('patient-bed row', () => {
      const row = [String(bed), rng.pick(MONTHS), rng.pick(['Yes', 'No']), rng.pick(['Yes', 'No'])];
      return WINTER.includes(row[1]) && row[2] === 'No' && row[3] === 'Yes' ? null : row;
    });
  });
  return buildLevel({
    template,
    context,
    answerKind: 'code',
    answer: String(target),
    clueA: text(...copy.clueA),
    clueB: table(template, 'B', copy, rows),
    explanation: `Bed ${target} was admitted in winter, never discharged, and is by a window.`,
    solution: {
      table: 'B',
      where: [{ col: 1, op: 'in', value: WINTER }, { col: 2, op: 'eq', value: 'No' }, { col: 3, op: 'eq', value: 'Yes' }],
      pick: 0,
      sort: null,
      join: false,
    },
  });
}

/** Alchemist 1: six bottles; a rule of two conditions leaves 2 or 3 of them. */
function potions({ template, params, rng, context }) {
  const { copy } = params;
  const dir = rng.pick(params.sortDirection);
  const cols = Object.fromEntries(params.attributes.map((name, i) => [name, i + 1]));
  const wanted = rng.sample(params.attributes, params.conditions).map((attr) => ({ attr, value: rng.pick(params.values[attr]) }));
  const fits = (row) => wanted.every(({ attr, value }) => row[cols[attr]] === value);
  const attributes = (fixed) => params.attributes.map((attr) => (fixed && fixed[attr]) || rng.pick(params.values[attr]));
  return attempt('potions', () => {
    const ids = range(1, params.items);
    const winners = new Set(rng.sample(ids, rng.int(params.answerCount[0], params.answerCount[1])));
    const fixed = Object.fromEntries(wanted.map(({ attr, value }) => [attr, value]));
    const rows = ids.map((id) => {
      if (winners.has(id)) return [String(id), ...attributes(fixed)];
      return attempt('potions row', () => {
        const row = [String(id), ...attributes()];
        return fits(row) ? null : row;
      });
    });
    const answer = listAnswer(winners, dir);
    const rule = wanted.map(({ attr, value }) => fill(copy.conditions[attr], { value })).join(` ${copy.and} `);
    const clueA = table(template, 'A', copy, rows);
    const clueB = text(fill(copy.ruleB, { rule }), fill(copy.orderB, copy.directions[dir]));
    if (leaks(template, answer, 'list', clueA, clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'list',
      answer,
      clueA,
      clueB,
      explanation: `Bottles ${[...winners].sort(byNumber('asc')).join(', ')} meet both conditions: ${answer}.`,
      solution: { table: 'A', where: wanted.map(({ attr, value }) => ({ col: cols[attr], op: 'eq', value })), pick: 0, sort: dir, join: true },
    });
  });
}

/** Polar 3: six crates; exactly three pass the seal, weight and stencil checks. */
function crates({ template, params, rng, context }) {
  const { copy } = params;
  const dir = rng.pick(params.sortDirection);
  return attempt('crates', () => {
    const seal = rng.pick(params.values.seal);
    const stencil = rng.pick(params.values.stencil);
    const limit = rng.pick(params.weightLimits);
    const [wLo, wHi] = params.weightRange;
    const ids = rng.sample(range(params.idRange[0], params.idRange[1]), params.items).sort((a, b) => a - b);
    const winners = new Set(rng.sample(ids, params.answerCount));
    // Never exactly the limit, so "under" cannot be argued either way.
    const weight = (passes) => String(passes ? rng.int(wLo, limit - 1) : rng.int(limit + 1, wHi));
    const rows = ids.map((id) => {
      if (winners.has(id)) return [String(id), seal, weight(true), stencil];
      const broken = rng.sample([0, 1, 2], rng.int(1, 3));
      return [
        String(id),
        broken.includes(0) ? rng.pick(params.values.seal.filter((v) => v !== seal)) : seal,
        weight(!broken.includes(1)),
        broken.includes(2) ? rng.pick(params.values.stencil.filter((v) => v !== stencil)) : stencil,
      ];
    });
    const answer = listAnswer(winners, dir);
    const clueA = table(template, 'A', copy, rows);
    const clueB = text(fill(copy.ruleB, { seal, limit, stencil }), fill(copy.orderB, copy.directions[dir]));
    if (leaks(template, answer, 'list', clueA, clueB)) return null;
    return buildLevel({
      template,
      context,
      answerKind: 'list',
      answer,
      clueA,
      clueB,
      explanation: `Crates ${[...winners].sort(byNumber('asc')).join(', ')} pass all three checks: ${answer}.`,
      solution: {
        table: 'A',
        where: [{ col: 1, op: 'eq', value: seal }, { col: 2, op: 'lt', value: limit }, { col: 3, op: 'eq', value: stencil }],
        pick: 0,
        sort: dir,
        join: true,
      },
    });
  });
}

const VARIANTS = {
  'offline-servers': offlineServers,
  alibis,
  'shoe-size': shoeSize,
  'cursed-item': cursedItem,
  'patient-bed': patientBed,
  potions,
  crates,
};

/** Builds the level for `params.variant`; solve() re-derives the answer from the generated table. */
function generate(args) {
  const build = VARIANTS[args.params.variant];
  must(build, `Unknown rule-filter variant ${args.params.variant}`);
  return build(args);
}

module.exports = { solve, generate };
