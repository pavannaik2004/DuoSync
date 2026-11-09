const cyberHeist = require('../src/content/cyberHeist');
const { normalizeAnswer } = require('../src/services/answers');

test('theme: Cyber Heist, 15 minutes, Hacker and Decoder', () => {
  expect(cyberHeist.theme).toMatchObject({
    slug: 'cyber-heist',
    timerMinutes: 15,
    roles: { A: { name: 'Hacker' }, B: { name: 'Decoder' } },
  });
  for (const key of ['name', 'story', 'revealText', 'failText']) expect(cyberHeist.theme[key]).toEqual(expect.any(String));
});

test('5 levels in order with the §6.5 Cyber Heist titles', () => {
  expect(cyberHeist.levels.map((l) => l.order)).toEqual([1, 2, 3, 4, 5]);
  expect(cyberHeist.levels.map((l) => l.title))
    .toEqual(['Access PIN', 'Firewall', 'Server Reboot', 'Glyph Keypad', 'Vault Finale']);
});

test.each(cyberHeist.levels.map((l) => [l.title, l]))('%s: answer within limits and not shown by one half', (_, l) => {
  const ans = normalizeAnswer(l.answer, l.answerKind);
  if (l.answerKind === 'word') expect(ans).toMatch(/^[A-Z]{1,8}$/);
  if (l.answerKind === 'code') expect(ans).toMatch(/^\d{1,4}$/);
  if (l.answerKind === 'list') expect(ans).toMatch(/^[A-Z0-9]+(-[A-Z0-9]+)+$/);
  for (const half of [l.clueA, l.clueB]) {
    expect(['text', 'tokens', 'table', 'strip', 'symbols']).toContain(half.type);
    expect(normalizeAnswer(JSON.stringify(half.data), l.answerKind)).not.toContain(ans);
  }
  expect(l.hint).toEqual(expect.any(String));
  expect(l.explanation).toEqual(expect.any(String));
});

test('finale answer spells the rewards in the order clue A gives', () => {
  const [pin, firewall, reboot, glyph, finale] = cyberHeist.levels;
  expect([pin, firewall, reboot, glyph].map((l) => l.reward).sort()).toEqual(['D', 'E', 'N', 'O']);
  expect([firewall, glyph, pin, reboot].map((l) => l.reward).join('')).toBe(finale.answer);
  expect(finale.answer).toBe('NODE');
});

test('the Caesar clue really encodes the answer', () => {
  const firewall = cyberHeist.levels[1];
  const shift = firewall.clueB.data.shift;
  const encoded = firewall.clueA.data.paragraphs[1];
  const decoded = [...encoded].map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 - shift + 26) % 26) + 65)).join('');
  expect(decoded).toBe(firewall.answer);
});
