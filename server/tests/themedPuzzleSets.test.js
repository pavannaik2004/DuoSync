/**
 * Content checks for the Themed Puzzle Sets (docs/themed-puzzle-sets.md). Every theme's fallback level
 * set must pass the production validator (generators/validate.js), which solves it from its own clue
 * data, and every pool is checked against the rules the generators rely on.
 */
const { getContent, listThemes, fillText } = require('../src/content');
const { MECHANICS, SYMBOL_SHAPES, STYLE_KEYS, REWARD_RULES } = require('../src/content/catalog');
const { validateLevel } = require('../src/generators/validate');
const { normalizeAnswer: norm } = require('../src/services/answers');

const SLUGS = listThemes();
const THEMES = SLUGS.map((slug) => [slug, getContent(slug)]);
const LEVELS = THEMES.flatMap(([slug, c]) => c.templates.map((t, i) => [`${slug} #${t.order} ${t.title}`, slug, t, c.levels[i], c]));

const textOf = (clue) => clue.data.paragraphs.join(' ');
const lastLine = (clue) => clue.data.paragraphs[clue.data.paragraphs.length - 1];
const rowsOf = (clue) => clue.data.rows;
const WORD = /^[A-Z]{1,8}$/;

// ---------------------------------------------------------------- the catalogue

test('8 themes: the 4 from PRD §6.5 plus 4 new ones', () => {
  expect(SLUGS).toEqual([
    'cyber-heist', 'detective', 'space-station', 'pirate',
    'haunted-asylum', 'sun-king-tomb', 'alchemist-tower', 'polar-expedition',
  ]);
  expect(new Set(THEMES.map(([, c]) => c.theme.styleKey)).size).toBe(8);
});

test.each([
  ['cyber-heist', 'Cyber Heist – Operation Blackout', 15, ['Access PIN', 'Firewall', 'Server Reboot', 'Glyph Keypad', 'Vault Finale'],
    ['decode-key', 'caesar', 'rule-filter', 'describe-match', 'fragment-finale']],
  ['detective', 'Detective – Murder at Blackwood Manor', 20, ['Stopped Clock', 'Alibi Check', 'Footprint', 'Murder Weapon', 'Dying Message'],
    ['arithmetic', 'rule-filter', 'rule-filter', 'describe-match', 'caesar']],
  ['space-station', 'Space Station – Station Helios Emergency', 15, ['Oxygen Valves', 'Star Map', 'Power Routing', 'Distress Signal', 'Escape Pod Launch'],
    ['ordering', 'grid-lookup', 'decode-key', 'morse', 'fragment-finale']],
  ['pirate', "Pirate – Blackbeard's Lost Treasure", 18, ['Torn Parchment', 'Island Walk', 'Pirate Code', 'Cursed Chest', "Captain's Password"],
    ['split-riddle', 'grid-navigation', 'describe-match', 'rule-filter', 'fragment-finale']],
])('%s matches PRD §6.5', (slug, name, minutes, titles, mechanics) => {
  const { theme, templates } = getContent(slug);
  expect(theme.name).toBe(name);
  expect(theme.timerMinutes).toBe(minutes);
  expect(templates.map((t) => t.title)).toEqual(titles);
  expect(templates.map((t) => t.mechanic)).toEqual(mechanics);
});

test('every mechanic is used by at least 2 themes', () => {
  for (const mechanic of MECHANICS) {
    const users = THEMES.filter(([, c]) => c.templates.some((t) => t.mechanic === mechanic));
    expect([mechanic, users.length >= 2]).toEqual([mechanic, true]);
  }
});

test.each(THEMES)('%s: theme fields', (slug, { theme }) => {
  expect(theme.slug).toBe(slug);
  for (const key of ['name', 'genre', 'story', 'boardLabel', 'revealText', 'failText']) expect(theme[key]).toEqual(expect.any(String));
  expect(theme.timerMinutes).toBeGreaterThanOrEqual(10);
  expect(theme.timerMinutes).toBeLessThanOrEqual(30);
  expect(STYLE_KEYS).toContain(theme.styleKey);
  for (const role of ['A', 'B']) {
    expect(theme.roles[role].name).toEqual(expect.any(String));
    expect(theme.roles[role].description).toEqual(expect.any(String));
  }
  for (const [, order] of theme.revealText.matchAll(/\{([^}]*)\}/g)) expect(order).toMatch(/^answer\.[1-5]$/);
});

test.each(THEMES)('%s: 5 templates in order, finale last', (slug, { templates, pools }) => {
  expect(templates.map((t) => t.order)).toEqual([1, 2, 3, 4, 5]);
  expect(new Set(templates.map((t) => t.title)).size).toBe(5);
  templates.forEach((t) => {
    expect(MECHANICS).toContain(t.mechanic);
    if (t.mechanic === 'fragment-finale') expect(t.order).toBe(5);
    expect(t.timeEstimateSec).toBeGreaterThanOrEqual(30);
    expect(t.timeEstimateSec).toBeLessThanOrEqual(600);
    expect(t.params).toEqual(expect.any(Object));
    if (t.params.pool) expect(Object.keys(pools)).toContain(t.params.pool);
    if (t.order < 5) expect(REWARD_RULES).toContain(t.rewardRule);
    else expect(t.rewardRule).toBeNull();
  });
});

// ---------------------------------------------------------------- one level at a time

test.each(LEVELS)('%s: passes the production validator, hint carries no values', (_, slug, template, level, content) => {
  const i = template.order - 1;
  const full = { ...level, solution: template.fallback.solution };
  const context = { levels: content.levels.slice(0, i), pools: content.pools, params: template.params, plan: null };
  expect(validateLevel(full, { mechanic: template.mechanic, context })).toEqual([]);
  expect(level.solution).toBeUndefined();
  // Hints are shared by every generated instance, so they carry no values.
  expect(level.hint).toEqual(expect.any(String));
  expect(level.hint).not.toMatch(/\d/);
  expect(level.explanation).toEqual(expect.any(String));
});

test.each(LEVELS)('%s: reward follows the reward rule', (_, slug, template, level, content) => {
  if (template.order === 5) return expect(level.reward).toBeNull();
  switch (template.rewardRule) {
    case 'letter': return expect(level.reward).toMatch(/^[A-Z]$/);
    case 'digit': {
      expect(level.reward).toMatch(/^[1-9]$/);
      const digits = content.levels.slice(0, 4).map((l) => l.reward);
      return expect(new Set(digits).size).toBe(4);
    }
    case 'answer': return expect(level.reward).toBe(level.answer);
    default: return expect(level.reward).toEqual(expect.any(String));
  }
});

// ---------------------------------------------------------------- pools

const WORD_POOLS = ['caesarWords', 'morseWords', 'finaleWords', 'landmarks', 'codeWords', 'chestItems', 'hieroglyphWords', 'suspects', 'guardians'];
const MIN_SIZE = { caesarWords: 8, morseWords: 8, riddles: 6, suspects: 6, landmarks: 7, finaleWords: 6, codeWords: 6, chestItems: 5, hieroglyphWords: 6 };

test.each(THEMES)('%s: pools follow the generator rules', (slug, { pools, templates, levels }) => {
  for (const [key, pool] of Object.entries(pools)) {
    expect([...WORD_POOLS, 'riddles', 'weapons', 'witnesses']).toContain(key);
    if (MIN_SIZE[key]) expect(pool.length).toBeGreaterThanOrEqual(MIN_SIZE[key]);
    if (WORD_POOLS.includes(key)) {
      pool.forEach((w) => expect(w).toMatch(WORD));
      expect(new Set(pool).size).toBe(pool.length);
    }
  }
  (pools.finaleWords || []).forEach((w) => expect(w).toHaveLength(4));
  for (const key of ['codeWords', 'hieroglyphWords']) {
    (pools[key] || []).forEach((w) => expect(new Set(w).size + 2).toBeLessThanOrEqual(SYMBOL_SHAPES.length));
  }
  (pools.riddles || []).forEach((r) => {
    expect(r.answer).toMatch(WORD);
    for (const alt of r.acceptedAnswers) expect(norm(alt, 'word').length).toBeLessThanOrEqual(8);
    for (const half of [r.partA, r.partB]) expect(norm(half, 'word')).not.toContain(r.answer);
  });
  if (pools.weapons) {
    expect(pools.weapons).toHaveLength(5);
    pools.weapons.forEach((w) => {
      expect(w.name).toMatch(WORD);
      expect(norm(w.wound, 'word')).not.toContain(w.name);
    });
  }
  // A fallback answer drawn from a pool must be in that pool.
  templates.forEach((t, i) => {
    const pool = pools[t.params.pool];
    if (!pool) return;
    const entries = pool.map((e) => (typeof e === 'string' ? e : e.answer || e.name));
    expect(entries).toContain(levels[i].answer);
  });
  // Grid Navigation maps only use landmarks from the pool.
  templates.filter((t) => t.mechanic === 'grid-navigation').forEach((t) => {
    levels[t.order - 1].clueB.data.cells.forEach((cell) => expect(pools.landmarks).toContain(cell.label));
  });
});

test('Detective: alibi suspects come from the suspect pool', () => {
  const { pools, levels } = getContent('detective');
  const suspects = rowsOf(levels[1].clueA).map((row) => row[0]);
  expect(suspects).toHaveLength(4);
  suspects.forEach((s) => expect(pools.suspects).toContain(s));
});

test("Pirate: every Captain's Password word can be spelled by first letters of levels 1–4", () => {
  const { pools } = getContent('pirate');
  const byLevel = [pools.riddles.map((r) => r.answer), pools.landmarks, pools.codeWords, pools.chestItems];
  const permutations = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p])));
  for (const word of pools.finaleWords) {
    const spellable = permutations([0, 1, 2, 3]).some((levelFor) => [...word].every((letter, i) => byLevel[levelFor[i]].some((w) => w[0] === letter)));
    expect([word, spellable]).toEqual([word, true]);
  }
});

// ---------------------------------------------------------------- registry

test('fallback levels keep the Attempt level shape', () => {
  for (const [, { levels }] of THEMES) {
    levels.forEach((l) => expect(Object.keys(l).sort())
      .toEqual(['acceptedAnswers', 'answer', 'answerKind', 'clueA', 'clueB', 'explanation', 'hint', 'order', 'reward', 'title']));
  }
  expect(() => getContent('nope')).toThrow('Unknown theme');
});

test('fillText puts level answers into the reveal text', () => {
  const { theme, levels } = getContent('detective');
  expect(fillText(theme.revealText, levels)).toBe('It was CROWE, wearing size 8 shoes. The case of Blackwood Manor is closed.');
  expect(fillText('Hello {answer.9}', levels)).toBe('Hello {answer.9}');
});
