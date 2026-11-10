const { getContent, listThemes } = require('../src/content');
const { validateLevel, validateClue, revealsAnswer } = require('../src/generators/validate');

const clone = (x) => JSON.parse(JSON.stringify(x));

/** The fallback level (with its solution) and the context for it, built in order. */
function fallbackCases(slug) {
  const { templates, pools, levels } = getContent(slug);
  return templates.map((template, i) => {
    const level = { ...levels[i], solution: template.fallback.solution };
    const context = { levels: levels.slice(0, i), pools, params: template.params, plan: null };
    return { template, level, context };
  });
}

test.each(listThemes())('%s: every fallback level passes validateLevel', (slug) => {
  for (const { template, level, context } of fallbackCases(slug)) {
    expect([template.title, validateLevel(level, { mechanic: template.mechanic, context })]).toEqual([template.title, []]);
  }
});

const cyber = () => {
  const cases = fallbackCases('cyber-heist');
  return { cases, firewall: cases[1] };
};

test.each([
  ['an answer of 9 letters', (l) => { l.answer = 'ABCDEFGHI'; }],
  ['a code of 5 digits', (l) => { l.answerKind = 'code'; l.answer = '12345'; }],
  ['a code without a digit', (l) => { l.answerKind = 'code'; l.answer = 'ABCD'; }],
  ['an accepted answer of 9 letters', (l) => { l.acceptedAnswers = ['ABCDEFGHI']; }],
  ['clue A showing the answer in text', (l) => { l.clueA = { type: 'text', data: { paragraphs: ['The word is FIREWALL.'] } }; }],
  ['a solve that disagrees', (l) => { l.clueB.data.shift = 4; }],
  ['an unknown glyph', (l) => { l.clueA = { type: 'symbols', data: { symbols: [{ shape: 'skull' }] } }; }],
])('rejects %s', (_, mutate) => {
  const { firewall } = cyber();
  const mutated = clone(firewall.level);
  mutate(mutated);
  expect(validateLevel(mutated, { mechanic: firewall.template.mechanic, context: firewall.context }).length).toBeGreaterThan(0);
});

test('a solve that throws is an error, not a crash', () => {
  const { firewall } = cyber();
  const mutated = clone(firewall.level);
  mutated.clueB = { type: 'text', data: { paragraphs: ['nothing'] } };
  expect(validateLevel(mutated, { mechanic: 'caesar', context: firewall.context }).length).toBeGreaterThan(0);
});

test('revealsAnswer allows a candidate among 3 table rows only', () => {
  const half = { type: 'table', data: { columns: ['A'], rows: [['ONE'], ['TWO'], ['THREE']] } };
  expect(revealsAnswer(half, 'TWO', 'word')).toBe(false);
  expect(revealsAnswer({ type: 'table', data: { columns: ['A'], rows: [['ONE'], ['TWO']] } }, 'TWO', 'word')).toBe(true);
  expect(revealsAnswer({ type: 'text', data: { paragraphs: ['say TWO'] } }, 'TWO', 'word')).toBe(true);
});

test('validateClue reports shape errors', () => {
  expect(validateClue({ type: 'tokens', data: { tokens: [{ label: 'x', color: 'pink' }] } }).length).toBeGreaterThan(0);
  expect(validateClue({ type: 'nope', data: {} }).length).toBeGreaterThan(0);
  expect(validateClue({ type: 'text', data: { paragraphs: ['ok'] } })).toEqual([]);
});
