const { getContent, } = require('../../src/content');
const { createRng } = require('../../src/generators/rng');
const { validateLevel } = require('../../src/generators/validate');
const { GENERATORS } = require('../../src/generators');
const { shiftWord } = require('../../src/content/catalog');

const PLAN = { rewards: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' }, startsWith: {} };
const SEEDS = 300;

/** The five Detective levels for one seed, each generated with the earlier ones as context (Task 5's generateLevelSet does this for real). */
function detectiveSet(seed) {
  const { templates, pools } = getContent('detective');
  const levels = [];
  for (const template of templates) {
    const context = { levels: [...levels], pools, params: template.params, plan: PLAN };
    const level = GENERATORS[template.mechanic].generate({
      template, params: template.params, pools, rng: createRng(`${seed}:${template.order}:0`), context,
    });
    expect([seed, template.order, validateLevel(level, { mechanic: template.mechanic, context })]).toEqual([seed, template.order, []]);
    levels.push(level);
  }
  return levels;
}

test('Dying Message: the killer is an uncleared suspect, shifted forward by the shoe size, over 300 seeds', () => {
  const killers = new Set();
  for (let s = 0; s < SEEDS; s += 1) {
    const levels = detectiveSet(`d${s}`);
    const suspects = levels[1].clueA.data.rows.map((r) => r[0]);
    expect(suspects).toContain(levels[4].answer);
    expect(levels[4].answer).not.toBe(levels[1].answer);
    expect(shiftWord(levels[4].clueA.data.paragraphs.at(-1), -Number(levels[2].answer))).toBe(levels[4].answer);
    expect(levels[4].clueB.data).toEqual({ caption: getContent('detective').templates[4].params.copy.stripCaption, numbered: true });
    expect(levels[4].reward).toBeNull();
    killers.add(levels[4].answer);
  }
  expect(killers.size).toBeGreaterThan(5);
});

test('the killer is each of the 3 uncleared suspects across seeds, and never the cleared one', () => {
  const seen = new Map();
  for (let s = 0; s < SEEDS; s += 1) {
    const levels = detectiveSet(`k${s}`);
    const uncleared = levels[1].clueA.data.rows.map((r) => r[0]).filter((n) => n !== levels[1].answer);
    expect(uncleared).toHaveLength(3);
    expect(uncleared).toContain(levels[4].answer);
    const key = uncleared.join();
    seen.set(key, new Set([...(seen.get(key) || []), levels[4].answer]));
  }
  expect([...seen.values()].some((killers) => killers.size === 3)).toBe(true);
});

test('the alibis are built around level 1: the cleared suspect covers the murder time', () => {
  for (let s = 0; s < SEEDS; s += 1) {
    const levels = detectiveSet(`a${s}`);
    expect(levels[1].solution.where[1].value).toBe(`${Number(levels[0].answer.slice(0, 2))}:${levels[0].answer.slice(2)} PM`);
    expect(levels[0].reward).toBe(`Murder at ${levels[1].solution.where[1].value}`);
  }
});

test('a shift of the shoe size (5-10) decodes level 5 and the Footprint answer is that shoe size', () => {
  for (let s = 0; s < 60; s += 1) {
    const levels = detectiveSet(`f${s}`);
    const size = Number(levels[2].answer);
    expect(size).toBeGreaterThanOrEqual(5);
    expect(size).toBeLessThanOrEqual(10);
    expect(levels[2].reward).toBe(`Shoe size ${size}`);
  }
});

// Needs generateLevelSet (Task 5): the same rules over a whole generated set, including the retry and fallback paths.
test.todo('the §6.5 consistency rules hold over 300 seeds of generateLevelSet(detective, seed)');
