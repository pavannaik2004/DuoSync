const { normalizeAnswer, isCorrect } = require('../src/services/answers');

test.each([
  ['11:25', 'code', '1125'],
  ['1125', 'code', '1125'],
  [' fire-wall ', 'word', 'FIREWALL'],
  ['3, 7, 9', 'list', '3-7-9'],
  ['3 7 9', 'list', '3-7-9'],
  ['3-7-9', 'list', '3-7-9'],
  [' 23--12 ,4 ', 'list', '23-12-4'],
])('normalizeAnswer(%p, %p) → %p', (text, kind, out) => {
  expect(normalizeAnswer(text, kind)).toBe(out);
});

test('a list typed without separators is not accepted', () => {
  expect(isCorrect({ answer: '3-7-9', acceptedAnswers: [], answerKind: 'list' }, '379')).toBe(false);
});

test('the main answer matches however it is typed', () => {
  expect(isCorrect({ answer: '23-12-4', acceptedAnswers: [], answerKind: 'list' }, '23, 12, 4')).toBe(true);
  expect(isCorrect({ answer: 'FIREWALL', acceptedAnswers: [], answerKind: 'word' }, 'firewall')).toBe(true);
});

test('accepted alternatives match', () => {
  expect(isCorrect({ answer: 'NODE', acceptedAnswers: ['NODES'], answerKind: 'word' }, 'nodes')).toBe(true);
});

test('punctuation-only input is never correct', () => {
  expect(isCorrect({ answer: 'X', acceptedAnswers: [], answerKind: 'word' }, ' -- ')).toBe(false);
});
