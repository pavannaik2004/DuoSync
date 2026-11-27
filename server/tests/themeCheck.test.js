const { getContent, listThemes } = require('../src/content');
const { checkTheme, CHECK_SEEDS } = require('../src/services/themeCheck');

const clone = (slug) => structuredClone(getContent(slug));

test('CHECK_SEEDS is 10 (D84)', () => {
  expect(CHECK_SEEDS).toBe(10);
});

test.each(listThemes())('built-in theme %s passes the check', (slug) => {
  expect(checkTheme(getContent(slug))).toEqual([]);
});

test('four levels: one problem naming the count, nothing else checked', () => {
  const c = clone('cyber-heist');
  expect(checkTheme({ ...c, templates: c.templates.slice(0, 4) }))
    .toEqual([{ order: null, message: 'A theme needs exactly 5 levels (it has 4)' }]);
});

test('levels numbered 1,2,3,4,6 are reported', () => {
  const c = clone('cyber-heist');
  c.templates[4].order = 6;
  expect(checkTheme(c)).toEqual([{ order: null, message: 'Levels must be numbered 1 to 5' }]);
});

test('a fixed answer the clues do not give is reported on its level', () => {
  const c = clone('cyber-heist');
  c.templates[0].fallback.answer = '1111';
  expect(checkTheme(c)).toContainEqual({ order: 1, message: expect.stringMatching(/^Fixed values: /) });
});

test('a params pool that the theme lacks fails generation on that level', () => {
  const c = clone('cyber-heist');
  delete c.pools.caesarWords;
  const problems = checkTheme(c);
  expect(problems).toContainEqual({ order: 2, message: expect.stringMatching(/^Generation: /) });
  expect(problems.filter((p) => p.message.startsWith('Generation: '))).toHaveLength(1);
});

test.each([
  [{ styleKey: 'neon' }, 'Choose a visual style from the list'],
  [{ timerMinutes: 3 }, 'Timer must be 5 to 60 minutes'],
  [{ timerMinutes: 61 }, 'Timer must be 5 to 60 minutes'],
  [{ roles: { A: { name: '' }, B: { name: 'Decoder' } } }, 'Both roles need a name'],
])('theme field %o is reported', (patch, message) => {
  const c = clone('cyber-heist');
  c.theme = { ...c.theme, ...patch };
  expect(checkTheme(c)).toContainEqual({ order: null, message });
});

// Final review #1: admin params come over HTTP now, so an impossible or huge range must fail fast, never hang.
const paramsOf = (slug, order, patch) => {
  const c = clone(slug);
  const t = c.templates.find((x) => x.order === order);
  t.params = { ...t.params, ...patch };
  return c;
};
test.each([
  ['ordering: a value range smaller than the item count', () => paramsOf('space-station', 1, { valueRange: [1, 3] }), 1],
  ['rule-filter: a huge id range', () => paramsOf('cyber-heist', 3, { idRange: [1, 200000000] }), 3],
  ['grid-navigation: a huge map', () => paramsOf('pirate', 2, { rows: 100000, cols: 100000 }), 2],
  ['grid-navigation: a huge move count', () => paramsOf('pirate', 2, { moves: 100000000 }), 2],
])('%s is a Generation problem, reported quickly', (_, make, order) => {
  const started = Date.now();
  expect(checkTheme(make())).toContainEqual({ order, message: expect.stringMatching(/^Generation: /) });
  expect(Date.now() - started).toBeLessThan(5000);
});
