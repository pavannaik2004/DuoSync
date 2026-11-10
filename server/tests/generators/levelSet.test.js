const { getContent, listThemes } = require('../../src/content');
const { generateLevelSet } = require('../../src/generators/levelSet');
const { plan } = require('../../src/generators/fragmentFinale');
const { createRng } = require('../../src/generators/rng');

const THEMES = listThemes();
const content = (slug) => getContent(slug);

test.each(THEMES)('%s: 100 seeds all pass validation without fallback (§11 acceptance)', (slug) => {
  const c = content(slug);
  for (let s = 0; s < 100; s += 1) {
    const set = generateLevelSet(c, `seed-${s}`);
    expect([s, set.usedFallback]).toEqual([s, false]);
  }
});

test.each(THEMES)('%s: same seed gives a deep-equal set, with five levels in the Attempt shape', (slug) => {
  const c = content(slug);
  const a = generateLevelSet(c, 'x1');
  expect(a).toEqual(generateLevelSet(c, 'x1'));
  expect(a.seed).toBe('x1');
  expect(a.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5]);
  for (const l of a.levels) {
    expect(Object.keys(l).sort()).toEqual(['acceptedAnswers', 'answer', 'answerKind', 'clueA', 'clueB', 'explanation', 'hint', 'order', 'reward', 'title']);
  }
});

test.each(THEMES)('%s: two seeds differ in at least 4 of 5 levels (§11 acceptance)', (slug) => {
  const c = content(slug);
  for (let s = 0; s < 50; s += 1) {
    const a = generateLevelSet(c, `a${s}`).levels;
    const b = generateLevelSet(c, `b${s}`).levels;
    const differ = a.filter((l, i) => JSON.stringify([l.clueA, l.clueB, l.answer]) !== JSON.stringify([b[i].clueA, b[i].clueB, b[i].answer]));
    expect([s, differ.length >= 4]).toEqual([s, true]);
  }
});

test('no generated level carries solution', () => {
  for (const slug of THEMES) {
    for (let s = 0; s < 5; s += 1) {
      for (const l of generateLevelSet(content(slug), `n${s}`).levels) expect(l).not.toHaveProperty('solution');
    }
  }
});

test('a template whose generator always fails gives the fallback set and usedFallback', () => {
  const c = content('cyber-heist');
  const broken = { ...c, templates: c.templates.map((t) => (t.order === 3 ? { ...t, params: { ...t.params, variant: 'no-such-variant' } } : t)) };
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const set = generateLevelSet(broken, 'zz');
  expect(set.usedFallback).toBe(true);
  expect(set.levels.map((l) => l.answer)).toEqual(c.levels.map((l) => l.answer));
  for (const l of set.levels) expect(l).not.toHaveProperty('solution');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toMatch(/cyber-heist.*3.*zz/);
  warn.mockRestore();
});

describe('finale plan', () => {
  const planFor = (slug, seed) => {
    const { templates, pools } = content(slug);
    const finale = templates.find((t) => t.mechanic === 'fragment-finale');
    return plan({ templates, params: finale.params, pools, rng: createRng(`${seed}:plan`) });
  };

  test.each(['space-station', 'sun-king-tomb', 'polar-expedition'])('%s: four distinct digits 1-9; the finale answer is them in finale order', (slug) => {
    for (let s = 0; s < 50; s += 1) {
      const p = planFor(slug, s);
      const digits = [1, 2, 3, 4].map((o) => p.rewards[o]);
      expect(digits.every((d) => /^[1-9]$/.test(d))).toBe(true);
      expect(new Set(digits).size).toBe(4);
      expect([...p.order].sort()).toEqual([1, 2, 3, 4]);
      expect(p.answer).toBe(p.order.map((o) => p.rewards[o]).join(''));
      const set = generateLevelSet(content(slug), `dg${s}`);
      expect(set.levels[4].answerKind).toBe('code');
      expect(set.levels[4].answer).toMatch(/^[1-9]{4}$/);
      expect(set.levels.slice(0, 4).map((l) => l.reward)).toEqual([1, 2, 3, 4].map((o) => planFor(slug, `dg${s}`).rewards[o]));
    }
  });

  test('letter finales: a pool word spread over the levels in finale order', () => {
    for (let s = 0; s < 30; s += 1) {
      const p = planFor('cyber-heist', s);
      expect(content('cyber-heist').pools.finaleWords).toContain(p.answer);
      expect(p.order.map((o) => p.rewards[o]).join('')).toBe(p.answer);
    }
  });

  test('Pirate: the password letters are first letters the level pools can supply', () => {
    for (let s = 0; s < 50; s += 1) {
      const p = planFor('pirate', s);
      expect(p.rewards).toEqual({});
      expect(p.order.map((o) => p.startsWith[o]).join('')).toBe(p.answer);
      const set = generateLevelSet(content('pirate'), `pp${s}`);
      expect(set.usedFallback).toBe(false);
      expect(set.levels.slice(0, 4).map((l) => l.answer[0])).toEqual([1, 2, 3, 4].map((o) => planFor('pirate', `pp${s}`).startsWith[o]));
      expect(set.levels[4].answer).toBe(planFor('pirate', `pp${s}`).answer);
    }
  });

  test('Detective has no fragment finale: no planned rewards', () => {
    const { templates, pools } = content('detective');
    const p = plan({ templates, params: {}, pools, rng: createRng('d:plan') });
    expect(p.rewards).toEqual({});
    expect(p.startsWith).toEqual({});
  });
});
