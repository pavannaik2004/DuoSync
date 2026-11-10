const { getContent, listThemes } = require('../../src/content');
const { createRng } = require('../../src/generators/rng');
const { validateLevel } = require('../../src/generators/validate');
const { GENERATORS } = require('../../src/generators');
const { pickAnswer, rewardFor } = require('../../src/generators/pick');

const MECHANICS = ['decode-key', 'caesar', 'morse', 'split-riddle', 'grid-lookup', 'grid-navigation', 'ordering'];
const STUB_PLAN = { rewards: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }, startsWith: {} };
const SEEDS = 200;

const CASES = [];
for (const slug of listThemes()) {
  for (const template of getContent(slug).templates) {
    if (MECHANICS.includes(template.mechanic)) CASES.push([slug, template.order, template.mechanic]);
  }
}

/** A context for one template: earlier levels are the fallbacks, so carried-over values (Detective) exist. */
function contextFor(slug, order, plan = STUB_PLAN) {
  const { templates, pools, levels } = getContent(slug);
  const template = templates.find((t) => t.order === order);
  return { template, pools, context: { levels: levels.slice(0, order - 1), pools, params: template.params, plan } };
}

function run(slug, order, seed, plan) {
  const { template, pools, context } = contextFor(slug, order, plan);
  const level = GENERATORS[template.mechanic].generate({
    template, params: template.params, pools, rng: createRng(`${seed}:${order}:0`), context,
  });
  return { level, template, context };
}

test('there are cases to run', () => {
  expect(CASES.length).toBe(19);
});

test.each(CASES)('%s level %i (%s): 200 seeds all validate', (slug, order, mechanic) => {
  for (let s = 0; s < SEEDS; s += 1) {
    const { level, template, context } = run(slug, order, `t${s}`);
    expect([s, validateLevel(level, { mechanic, context })]).toEqual([s, []]);
    expect(level.explanation.length).toBeGreaterThan(5);
    expect(level.reward).toBe(rewardFor(template, level.answer, context));
  }
});

test('the same key rebuilds the same level', () => {
  for (const [slug, order] of CASES) {
    expect(run(slug, order, 'same').level).toEqual(run(slug, order, 'same').level);
  }
});

test('Firewall: shift stays in 1-5 and the word comes from caesarWords', () => {
  const shifts = new Set();
  for (let s = 0; s < SEEDS; s += 1) {
    const { level } = run('cyber-heist', 2, `t${s}`);
    const { shift, direction } = level.clueB.data;
    expect(shift).toBeGreaterThanOrEqual(1);
    expect(shift).toBeLessThanOrEqual(5);
    expect(direction).toBe('back');
    expect(getContent('cyber-heist').pools.caesarWords).toContain(level.answer);
    shifts.add(shift);
  }
  expect(shifts.size).toBe(5);
});

test('Island Walk honours plan.startsWith for the Pirate finale', () => {
  const plan = { ...STUB_PLAN, startsWith: { 2: 'W' } };
  for (let s = 0; s < SEEDS; s += 1) {
    expect(['WELL', 'WRECK']).toContain(run('pirate', 2, `t${s}`, plan).level.answer);
  }
});

test('Torn Parchment honours plan.startsWith', () => {
  const plan = { ...STUB_PLAN, startsWith: { 1: 'B' } };
  for (let s = 0; s < SEEDS; s += 1) {
    expect(['BOTTLE', 'BREATH']).toContain(run('pirate', 1, `t${s}`, plan).level.answer);
  }
});

test('pickAnswer keeps only matching entries and fails when none match', () => {
  const rng = createRng('pick');
  const plan = { startsWith: { 3: 'c' } };
  for (let i = 0; i < 20; i += 1) {
    expect(['CAT', 'CUP']).toContain(pickAnswer(['CAT', 'DOG', 'CUP'], rng, { plan }, 3));
    expect(pickAnswer([{ answer: 'ZED' }, { answer: 'CAT' }], rng, { plan }, 3).answer).toBe('CAT');
  }
  expect(['CAT', 'DOG']).toContain(pickAnswer(['CAT', 'DOG'], rng, { plan }, 2));
  expect(() => pickAnswer(['DOG'], rng, { plan }, 3)).toThrow();
});

test('rewardFor: letter, digit, answer, caseNote and none', () => {
  const context = { plan: STUB_PLAN };
  expect(rewardFor({ order: 2, rewardRule: 'letter', params: {} }, 'X', context)).toBe('B');
  expect(rewardFor({ order: 3, rewardRule: 'digit', params: {} }, 'X', context)).toBe('C');
  expect(rewardFor({ order: 1, rewardRule: 'answer', params: {} }, 'MAP', context)).toBe('MAP');
  expect(rewardFor({ order: 1, rewardRule: 'caseNote', params: { copy: { reward: '{answer} is cleared' } } }, 'BELLAMY', context)).toBe('BELLAMY is cleared');
  expect(rewardFor({ order: 5, rewardRule: null, params: {} }, 'X', context)).toBeNull();
});

test('Grid Navigation never passes over another landmark and ends on the answer', () => {
  const MOVES = { north: [-1, 0], south: [1, 0], east: [0, 1], west: [0, -1] };
  const navs = CASES.filter(([, , mechanic]) => mechanic === 'grid-navigation');
  expect(navs.length).toBe(3);
  for (const [slug, order] of navs) {
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run(slug, order, `t${s}`);
      const { cells, rows, cols } = level.clueB.data;
      const text = level.clueA.data.paragraphs.join(' ');
      const start = cells.find((c) => c.label === text.match(/Start (?:at|on) the ([A-Z]+)/)[1]);
      const moves = [...text.matchAll(/(\d+) \w+ (north|south|east|west)/g)];
      expect(moves).toHaveLength(3);
      expect(cells).toHaveLength(7);
      let { r, c } = start;
      const landmarkAt = (rr, cc) => cells.find((cell) => cell.r === rr && cell.c === cc);
      moves.forEach(([, count, dir], m) => {
        expect(Number(count)).toBeGreaterThanOrEqual(1);
        expect(Number(count)).toBeLessThanOrEqual(3);
        for (let i = 0; i < Number(count); i += 1) {
          r += MOVES[dir][0];
          c += MOVES[dir][1];
          expect(r >= 0 && r < rows && c >= 0 && c < cols).toBe(true);
          const last = m === 2 && i === Number(count) - 1;
          if (!last) expect(landmarkAt(r, c)).toBeUndefined();
        }
      });
      expect(landmarkAt(r, c).label).toBe(level.answer);
      expect(landmarkAt(r, c)).not.toBe(start);
    }
  }
});

test('Ordering values are distinct, ids are distinct 1-9, and the table is not already in order', () => {
  for (const [slug, order] of CASES.filter(([, , m]) => m === 'ordering')) {
    const { template } = contextFor(slug, order);
    const [lo, hi] = template.params.valueRange;
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run(slug, order, `t${s}`);
      const ids = level.clueA.data.rows.map((row) => row[0]);
      const values = level.clueA.data.rows.map((row) => Number(row[1]));
      expect(new Set(values).size).toBe(4);
      expect(new Set(ids).size).toBe(4);
      expect(ids.every((id) => /^[1-9]$/.test(id))).toBe(true);
      expect(values.every((v) => v >= lo && v <= hi)).toBe(true);
      expect(level.answer).not.toBe(ids.join(''));
    }
  }
});

test('Grid Lookup labels skip I and O and are distinct', () => {
  for (const [slug, order] of CASES.filter(([, , m]) => m === 'grid-lookup')) {
    for (let s = 0; s < SEEDS; s += 1) {
      const { colLabels, rowLabels } = run(slug, order, `t${s}`).level.clueB.data;
      expect(new Set(colLabels).size).toBe(colLabels.length);
      expect(new Set(rowLabels).size).toBe(rowLabels.length);
      expect(colLabels.join('')).toMatch(/^[A-HJ-NP-Z]+$/);
      expect(rowLabels.join('')).toMatch(/^[1-9]+$/);
    }
  }
});

test('Decode Key: 4 distinct digits 1-9 and a shuffled order', () => {
  for (const [slug, order] of CASES.filter(([, , m]) => m === 'decode-key')) {
    for (let s = 0; s < SEEDS; s += 1) {
      const { level } = run(slug, order, `t${s}`);
      const values = level.clueA.data.tokens.map((t) => t.value);
      expect(new Set(values).size).toBe(4);
      expect(values.every((v) => /^[1-9]$/.test(v))).toBe(true);
      expect(level.clueB.data.tokens.map((t) => t.label).join()).not.toBe(level.clueA.data.tokens.map((t) => t.label).join());
    }
  }
});

test('Detective Dying Message: the killer is an uncleared suspect, shifted by the shoe size', () => {
  const { levels } = getContent('detective');
  const suspects = levels[1].clueA.data.rows.map((row) => row[0]).filter((n) => n !== levels[1].answer);
  for (let s = 0; s < SEEDS; s += 1) {
    const { level } = run('detective', 5, `t${s}`);
    expect(suspects).toContain(level.answer);
    expect(level.reward).toBeNull();
    expect(level.clueB.data.numbered).toBe(true);
  }
});

test('rewardFor throws when a letter or digit level has no planned reward', () => {
  const { templates } = getContent('cyber-heist');
  expect(() => rewardFor(templates[0], 'ANY', { plan: { rewards: {}, startsWith: {} } })).toThrow(/No planned reward/);
  expect(rewardFor(templates[0], 'ANY', { plan: STUB_PLAN })).toBe('A');
});
