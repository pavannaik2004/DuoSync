const { getContent } = require('../../src/content');
const { createRng } = require('../../src/generators/rng');
const { validateLevel } = require('../../src/generators/validate');
const { GENERATORS } = require('../../src/generators');
const { attempt, rewardFor } = require('../../src/generators/pick');
const ruleFilter = require('../../src/generators/ruleFilter');
const arithmetic = require('../../src/generators/arithmetic');
const { minutesOf } = require('../../src/generators/util');

const STUB_PLAN = { rewards: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }, startsWith: {} };
const SEEDS = 300;

// [theme, order, mechanic, variant, rows the rule must leave: a number, or [min, max]]
const VARIANT_CASES = [
  ['cyber-heist', 3, 'rule-filter', 'offline-servers', 3],
  ['detective', 2, 'rule-filter', 'alibis', 1],
  ['detective', 3, 'rule-filter', 'shoe-size', 1],
  ['pirate', 4, 'rule-filter', 'cursed-item', 1],
  ['haunted-asylum', 2, 'rule-filter', 'patient-bed', 1],
  ['alchemist-tower', 1, 'rule-filter', 'potions', [2, 3]],
  ['polar-expedition', 3, 'rule-filter', 'crates', 3],
  ['cyber-heist', 4, 'describe-match', 'glyph-digits', null],
  ['pirate', 3, 'describe-match', 'glyph-letters', null],
  ['sun-king-tomb', 1, 'describe-match', 'glyph-letters', null],
  ['detective', 4, 'describe-match', 'weapon', null],
  ['detective', 1, 'arithmetic', 'clock-fast', null],
  ['sun-king-tomb', 3, 'arithmetic', 'clock-slow', null],
  ['polar-expedition', 4, 'arithmetic', 'gauge-high', null],
];

/** Level `order` of a theme. Earlier levels are the fallbacks, except the Detective's, which are generated for the same seed. */
function run(slug, order, seed) {
  const { templates, pools, levels } = getContent(slug);
  const template = templates.find((t) => t.order === order);
  let earlier = levels.slice(0, order - 1);
  if (slug === 'detective') {
    earlier = [];
    for (const prior of templates.filter((t) => t.order < order)) {
      earlier.push(GENERATORS[prior.mechanic].generate({
        template: prior,
        params: prior.params,
        pools,
        rng: createRng(`${seed}:${prior.order}:0`),
        context: { levels: [...earlier], pools, params: prior.params, plan: STUB_PLAN },
      }));
    }
  }
  const context = { levels: earlier, pools, params: template.params, plan: STUB_PLAN };
  const level = GENERATORS[template.mechanic].generate({
    template, params: template.params, pools, rng: createRng(`${seed}:${order}:0`), context,
  });
  return { level, template, context, pools };
}

/** Rows of the solution's table that pass every condition, counted here and not by the solver under test. */
function matching(level) {
  const { solution } = level;
  const clue = solution.table === 'A' ? level.clueA : level.clueB;
  const pass = {
    eq: (cell, c) => cell === c.value,
    ne: (cell, c) => cell !== c.value,
    lt: (cell, c) => Number(cell) < c.value,
    in: (cell, c) => c.value.includes(cell),
    covers: (cell, c, row) => minutesOf(row[c.cols[0]]) <= minutesOf(c.value) && minutesOf(c.value) <= minutesOf(row[c.cols[1]]),
  };
  return clue.data.rows.filter((row) => solution.where.every((c) => pass[c.op](row[c.col], c, row)));
}

const numbers = (text) => (text.match(/(?<!\d)\d+(?!\d)/g) || []).map(Number);

test('the cases cover all 14 templates and each one declares its variant and copy', () => {
  expect(VARIANT_CASES).toHaveLength(14);
  for (const [slug, order, mechanic, variant] of VARIANT_CASES) {
    const template = getContent(slug).templates.find((t) => t.order === order);
    expect([template.mechanic, template.params.variant]).toEqual([mechanic, variant]);
    expect(typeof template.params.copy).toBe('object');
  }
});

test.each(VARIANT_CASES)('%s level %i (%s/%s): 300 seeds validate and the rule leaves the expected count', (slug, order, mechanic, variant, expected) => {
  for (let s = 0; s < SEEDS; s += 1) {
    const { level, context } = run(slug, order, `v${s}`);
    expect([s, validateLevel(level, { mechanic, context })]).toEqual([s, []]);
    expect(level.explanation.length).toBeGreaterThan(5);
    if (expected !== null) {
      const hits = matching(level).length;
      if (Array.isArray(expected)) expect([hits >= expected[0], hits <= expected[1]]).toEqual([true, true]);
      else expect(hits).toBe(expected);
    }
  }
});

test.each(VARIANT_CASES)('%s level %i (%s/%s): the same key rebuilds the same level, and the reward follows the rule', (slug, order) => {
  const a = run(slug, order, 'same');
  expect(run(slug, order, 'same').level).toEqual(a.level);
  const values = order === 1 && slug === 'detective' ? { time: a.level.reward.replace('Murder at ', '') } : {};
  expect(a.level.reward).toBe(rewardFor(a.template, a.level.answer, a.context, values));
});

describe('rule-filter', () => {
  test('Server Reboot: 6 distinct ids in 1-30, 3 offline, both directions, sorted numerically', () => {
    const dirs = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('cyber-heist', 3, `v${s}`);
      const ids = level.clueA.data.rows.map((r) => Number(r[0]));
      expect(new Set(ids)).toHaveProperty('size', 6);
      expect(ids.every((id) => id >= 1 && id <= 30)).toBe(true);
      const offline = level.clueA.data.rows.filter((r) => r[2] === 'OFF' && r[1] !== 'GREEN').map((r) => Number(r[0]));
      const dir = level.solution.sort;
      dirs.add(dir);
      expect(level.answer).toBe([...offline].sort((x, y) => (dir === 'asc' ? x - y : y - x)).join('-'));
      expect(level.clueB.data.paragraphs.join(' ')).toContain(dir === 'asc' ? 'lowest ID to the highest' : 'highest ID to the lowest');
    }
    expect(dirs.size).toBe(2);
  });

  test('picks are numeric where sorted (9 sorts below 10)', () => {
    const level = {
      clueA: { type: 'table', data: { columns: ['ID'], rows: [['9'], ['10'], ['2']] } },
      clueB: { type: 'text', data: { paragraphs: ['x'] } },
      solution: { table: 'A', where: [{ col: 0, op: 'ne', value: 'none' }], pick: 0, sort: 'desc', join: true },
    };
    expect(ruleFilter.solve(level)).toBe('10-9-2');
    expect(ruleFilter.solve({ ...level, solution: { ...level.solution, sort: 'asc' } })).toBe('2-9-10');
  });

  test('Alibi Check: suspects come from the pool, one is cleared at the murder time, the rest are not', () => {
    const times = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level, pools, context } = run('detective', 2, `v${s}`);
      const rows = level.clueA.data.rows;
      const at = level.solution.where[1].value;
      times.add(at);
      expect(at).toBe(`${Number(context.levels[0].answer.slice(0, 2))}:${context.levels[0].answer.slice(2)} PM`);
      expect(rows).toHaveLength(4);
      expect(new Set(rows.map((r) => r[0])).size).toBe(4);
      expect(rows.every((r) => pools.suspects.includes(r[0]))).toBe(true);
      expect(rows.some((r) => r[1] === 'nobody')).toBe(true);
      expect(rows.filter((r) => r[1] !== 'nobody').every((r) => pools.witnesses.includes(r[1]))).toBe(true);
      // A covering interval without a witness exists, so the interval alone cannot clear anyone.
      expect(rows.some((r) => r[1] === 'nobody' && minutesOf(r[2]) <= minutesOf(at) && minutesOf(at) <= minutesOf(r[3]))).toBe(true);
      for (const r of rows) expect(minutesOf(r[2])).toBeLessThan(minutesOf(r[3]));
    }
    expect(times.size).toBeGreaterThan(3);
  });

  test('Footprint: prints 22-27 cm against the fixed chart', () => {
    const { levels } = getContent('detective');
    const seen = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('detective', 3, `v${s}`);
      const cm = Number(level.clueA.data.paragraphs[1].match(/(\d+) cm/)[1]);
      seen.add(cm);
      expect(cm).toBeGreaterThanOrEqual(22);
      expect(cm).toBeLessThanOrEqual(27);
      expect(Number(level.answer)).toBe(cm - 17);
      expect(level.clueB).toEqual(levels[2].clueB);
    }
    expect(seen.size).toBe(6);
  });

  test('Cursed Chest: every rule variant appears, with 5 pool items and exactly 1 match', () => {
    const shapes = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level, pools, template } = run('pirate', 4, `v${s}`);
      const rows = level.clueA.data.rows;
      expect(rows).toHaveLength(5);
      expect(new Set(rows.map((r) => r[0])).size).toBe(5);
      expect(rows.every((r) => pools.chestItems.includes(r[0]) && template.params.colours.includes(r[1]) && template.params.kinds.includes(r[2]))).toBe(true);
      shapes.add(level.solution.where.map((c) => `${c.col}:${c.op}`).join(' '));
      expect(matching(level)).toHaveLength(1);
    }
    expect([...shapes].sort()).toEqual(['1:eq 2:eq', '1:eq 2:ne', '1:ne 2:eq']);
  });

  test('Cursed Chest honours plan.startsWith', () => {
    const { templates, pools } = getContent('pirate');
    const template = templates.find((t) => t.order === 4);
    for (let s = 0; s < 100; s += 1) {
      const context = { levels: [], pools, params: template.params, plan: { rewards: {}, startsWith: { 4: 'A' } } };
      const level = GENERATORS['rule-filter'].generate({ template, params: template.params, pools, rng: createRng(`p${s}`), context });
      expect(level.answer.startsWith('A')).toBe(true);
    }
  });

  test('Ward 13: 6 beds in 1-30; only one is winter, never discharged, by a window', () => {
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('haunted-asylum', 2, `v${s}`);
      const beds = level.clueB.data.rows.map((r) => Number(r[0]));
      expect(new Set(beds).size).toBe(6);
      expect(beds.every((b) => b >= 1 && b <= 30)).toBe(true);
      expect(matching(level).map((r) => r[0])).toEqual([level.answer]);
    }
  });

  test('Potion Shelf: bottles 1-6, 2 or 3 leave, both counts and directions appear', () => {
    const counts = new Set();
    const dirs = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('alchemist-tower', 1, `v${s}`);
      expect(level.clueA.data.rows.map((r) => r[0])).toEqual(['1', '2', '3', '4', '5', '6']);
      counts.add(level.answer.split('-').length);
      dirs.add(level.solution.sort);
      expect(level.solution.where).toHaveLength(2);
      expect(level.clueB.data.paragraphs[0].match(/\bis\b/g).length).toBeGreaterThanOrEqual(2);
    }
    expect([...counts].sort()).toEqual([2, 3]);
    expect(dirs.size).toBe(2);
  });

  test('Supply Crates: ids 1-20, 3 conditions, 3 left, no weight equal to the limit', () => {
    const dirs = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('polar-expedition', 3, `v${s}`);
      const rows = level.clueA.data.rows;
      const limit = level.solution.where[1].value;
      expect(level.solution.where).toHaveLength(3);
      expect(new Set(rows.map((r) => r[0])).size).toBe(6);
      expect(rows.every((r) => Number(r[0]) >= 1 && Number(r[0]) <= 20)).toBe(true);
      expect(rows.every((r) => Number(r[2]) !== limit)).toBe(true);
      expect(level.clueB.data.paragraphs[0]).toContain(`under ${limit} kg`);
      dirs.add(level.solution.sort);
    }
    expect(dirs.size).toBe(2);
  });
});

describe('describe-match', () => {
  test('Glyph Keypad: 4 of the first 6 shapes, distinct digits, 1-2 decoys', () => {
    const decoyCounts = new Set();
    const { template } = run('cyber-heist', 4, 'x');
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('cyber-heist', 4, `v${s}`);
      const shown = level.clueA.data.symbols.map((x) => x.shape);
      const legend = level.clueB.data.symbols;
      expect(new Set(shown).size).toBe(4);
      expect(shown.every((shape) => template.params.shapesFrom.includes(shape))).toBe(true);
      expect(new Set(legend.map((x) => x.shape)).size).toBe(legend.length);
      expect(new Set(legend.map((x) => x.label)).size).toBe(legend.length);
      expect(legend.every((x) => /^[1-9]$/.test(x.label))).toBe(true);
      decoyCounts.add(legend.length - 4);
    }
    expect([...decoyCounts].sort()).toEqual([1, 2]);
  });

  test.each([['pirate', 3], ['sun-king-tomb', 1]])('%s level %i: a distinct glyph per letter and exactly 2 decoys', (slug, order) => {
    for (let s = 0; s < SEEDS; s += 1) {
      const { level, template, pools } = run(slug, order, `v${s}`);
      expect(pools[template.params.pool]).toContain(level.answer);
      const legend = level.clueB.data.symbols;
      expect(new Set(legend.map((x) => x.shape)).size).toBe(legend.length);
      expect(new Set(legend.map((x) => x.label)).size).toBe(legend.length);
      expect(legend.length).toBe(new Set(level.answer).size + 2);
      expect(level.clueA.data.symbols).toHaveLength(level.answer.length);
    }
  });

  test('Murder Weapon: the register lists all 5 weapons once and the chosen mark is unique', () => {
    const { pools } = run('detective', 4, 'x');
    const chosen = new Set();
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run('detective', 4, `v${s}`);
      const rows = level.clueB.data.rows;
      expect(rows.map((r) => r[0]).sort()).toEqual(pools.weapons.map((w) => w.name).sort());
      expect(new Set(rows.map((r) => r[1])).size).toBe(5);
      const weapon = pools.weapons.find((w) => w.name === level.answer);
      expect(rows.filter((r) => r[1] === weapon.mark)).toHaveLength(1);
      expect(level.clueA.data.paragraphs).toEqual([weapon.wound]);
      chosen.add(level.answer);
    }
    expect(chosen.size).toBe(5);
  });
});

describe('arithmetic', () => {
  /** The wording must match the sign of the correction, and clue B must carry the size of it as a number of its own. */
  const WORDS = { 'clock-fast': ['fast', -1], 'clock-slow': ['behind', 1], 'gauge-high': ['too high', -1] };

  test.each([['detective', 1, 'clock-fast'], ['sun-king-tomb', 3, 'clock-slow'], ['polar-expedition', 4, 'gauge-high']])(
    '%s level %i (%s): ranges, wording, limits',
    (slug, order, variant) => {
      const seen = new Set();
      for (let s = 0; s < SEEDS; s += 1) {
        const { level } = run(slug, order, `v${s}`);
        const { delta, reading } = level.solution;
        const b = level.clueB.data.paragraphs.join(' ');
        const [word, sign] = WORDS[variant];
        expect(b).toContain(word);
        expect(Math.sign(delta)).toBe(sign);
        expect(numbers(b)).toContain(Math.abs(delta));
        // clue B holds the size once, and the only other number is the example answer
        expect(numbers(b).filter((n) => n === Math.abs(delta))).toHaveLength(1);
        expect(level.answer.length).toBeLessThanOrEqual(4);
        expect(level.answerKind).toBe('code');
        seen.add(`${delta}`);
        if (variant === 'clock-fast') {
          expect([10, 15, 20]).toContain(-delta);
          const murder = Number(level.answer.slice(0, 2)) * 60 + Number(level.answer.slice(2));
          expect(murder).toBeGreaterThanOrEqual(11 * 60 + 5);
          expect(murder).toBeLessThanOrEqual(11 * 60 + 35);
          expect(murder % 5).toBe(0);
          expect(level.reward).toBe(`Murder at ${Number(level.answer.slice(0, 2))}:${level.answer.slice(2)} PM`);
        } else if (variant === 'clock-slow') {
          const [h, m] = reading.split(':').map(Number);
          expect(h * 60 + m).toBeGreaterThanOrEqual(60);
          expect(h * 60 + m).toBeLessThanOrEqual(5 * 60 + 55);
          expect((h * 60 + m) % 5).toBe(0);
          expect(delta).toBeGreaterThanOrEqual(15);
          expect(delta).toBeLessThanOrEqual(35);
          expect(delta % 5).toBe(0);
          expect(level.answer).toMatch(/^\d{4}$/);
          expect(level.acceptedAnswers).toEqual(level.answer.startsWith('0') ? [level.answer.slice(1)] : []);
        } else {
          expect(Number(reading)).toBeGreaterThanOrEqual(200);
          expect(Number(reading)).toBeLessThanOrEqual(480);
          expect(Number(reading) % 5).toBe(0);
          expect(-delta).toBeGreaterThanOrEqual(15);
          expect(-delta).toBeLessThanOrEqual(60);
          expect(Number(level.answer)).toBe(Number(reading) + delta);
        }
      }
      expect(seen.size).toBeGreaterThan(2);
    },
  );

  test('solve finds the correction only as a number of its own (a delta of 5 is not 15 or 1050)', () => {
    const level = (b) => ({
      clueA: { type: 'text', data: { paragraphs: ['Its hands read 11:35.'] } },
      clueB: { type: 'text', data: { paragraphs: [b] } },
      solution: { reading: '11:35', delta: -5, format: 'clock' },
    });
    expect(() => arithmetic.solve(level('It runs 15 minutes fast. Enter it like 1050.'))).toThrow(/correction/);
    expect(arithmetic.solve(level('It runs 5 minutes fast. Enter it like 1050.'))).toBe('1130');
  });
});

test('attempt() stops after its tries and says which layout failed', () => {
  let calls = 0;
  expect(() => attempt('demo layout', () => { calls += 1; return null; }, 7)).toThrow('demo layout: no valid layout after 7 tries');
  expect(calls).toBe(7);
  expect(attempt('demo', (i) => (i === 3 ? 'ok' : null))).toBe('ok');
});

test('an unknown variant is refused', () => {
  for (const mechanic of ['rule-filter', 'describe-match', 'arithmetic']) {
    expect(() => GENERATORS[mechanic].generate({ params: { variant: 'nope' } })).toThrow(/Unknown .* variant nope/);
  }
});
