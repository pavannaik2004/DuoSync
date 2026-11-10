/**
 * Content checks for the Themed Puzzle Sets (docs/themed-puzzle-sets.md). Every theme's fallback
 * level set is solved here from its own clue data, so a fallback can never be inconsistent, and
 * every pool is checked against the rules the Phase 3 generators rely on.
 */
const { getContent, listThemes, fillText } = require('../src/content');
const {
  MECHANICS, CLUE_TYPES, SYMBOL_SHAPES, TOKEN_COLORS, STYLE_KEYS, REWARD_RULES, MORSE, morseChart, shiftWord,
} = require('../src/content/catalog');
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

function checkClueData({ type, data }) {
  expect(CLUE_TYPES).toContain(type);
  if (data.caption !== undefined) expect(data.caption).toEqual(expect.any(String));
  switch (type) {
    case 'text':
      expect(data.paragraphs.length).toBeGreaterThan(0);
      data.paragraphs.forEach((p) => expect(p).toEqual(expect.any(String)));
      break;
    case 'tokens':
      expect(data.tokens.length).toBeGreaterThan(0);
      data.tokens.forEach((t) => {
        expect(t.label).toEqual(expect.any(String));
        expect(TOKEN_COLORS).toContain(t.color);
        if (t.value !== undefined) expect(t.value).toEqual(expect.any(String));
      });
      break;
    case 'symbols':
      data.symbols.forEach((s) => {
        expect(SYMBOL_SHAPES).toContain(s.shape);
        if (s.label !== undefined) expect(s.label).toEqual(expect.any(String));
      });
      break;
    case 'table':
      data.columns.forEach((c) => expect(c).toEqual(expect.any(String)));
      data.rows.forEach((row) => {
        expect(row).toHaveLength(data.columns.length);
        row.forEach((cell) => expect(cell).toEqual(expect.any(String)));
      });
      break;
    case 'grid': {
      for (const n of [data.rows, data.cols]) expect(Number.isInteger(n) && n >= 2 && n <= 8).toBe(true);
      if (data.colLabels) expect(data.colLabels).toHaveLength(data.cols);
      if (data.rowLabels) expect(data.rowLabels).toHaveLength(data.rows);
      const seen = new Set();
      data.cells.forEach((cell) => {
        expect(cell.r >= 0 && cell.r < data.rows && cell.c >= 0 && cell.c < data.cols).toBe(true);
        expect(seen.has(`${cell.r},${cell.c}`)).toBe(false);
        seen.add(`${cell.r},${cell.c}`);
      });
      break;
    }
    case 'strip':
      if (data.numbered) expect(data.shift).toBeUndefined();
      else {
        expect(Number.isInteger(data.shift) && data.shift >= 1 && data.shift <= 25).toBe(true);
        expect(['back', 'forward']).toContain(data.direction);
      }
      break;
    default:
  }
}

/** A half may name the answer only as one candidate among at least 3 rows of a table or labelled cells of a grid. */
function revealsAnswer(half, answer, kind) {
  const target = norm(answer, kind);
  if (target.length < 3 || !norm(JSON.stringify(half.data), kind).includes(target)) return false;
  const isTarget = (s) => norm(s, kind) === target;
  if (half.type === 'table') return !(half.data.rows.length >= 3 && half.data.rows.some((row) => row.some(isTarget)));
  if (half.type === 'grid') {
    const labelled = half.data.cells.filter((c) => c.label);
    return !(labelled.length >= 3 && labelled.some((c) => isTarget(c.label)));
  }
  return true;
}

test.each(LEVELS)('%s: answer, clue data and hint', (_, slug, template, level) => {
  const kind = level.answerKind;
  const answer = norm(level.answer, kind);
  expect(answer).toBe(level.answer);
  if (kind === 'word') expect(answer).toMatch(WORD);
  if (kind === 'code') expect(answer).toMatch(/^(?=.*\d)[A-Z0-9]{1,4}$/);
  if (kind === 'list') {
    expect(answer).toMatch(/^[A-Z0-9]+(-[A-Z0-9]+)+$/);
    expect(answer.length).toBeLessThanOrEqual(8);
  }
  for (const alt of level.acceptedAnswers) {
    expect(norm(alt, kind).length).toBeGreaterThan(0);
    expect(norm(alt, kind).length).toBeLessThanOrEqual(8);
  }
  for (const half of [level.clueA, level.clueB]) {
    checkClueData(half);
    for (const candidate of [level.answer, ...level.acceptedAnswers]) expect(revealsAnswer(half, candidate, kind)).toBe(false);
  }
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

// ---------------------------------------------------------------- solving each fallback from its clues

const minutesOf = (hhmm) => {
  const [, h, m, half] = hhmm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  let hours = Number(h) % 12;
  if (half === 'PM') hours += 12;
  if (half === 'AM' && Number(h) === 12) hours = 24; // midnight closes the evening
  return (half ? hours : Number(h)) * 60 + Number(m);
};
const asHHMM = (total) => {
  const h = Math.floor(total / 60) % 12 || 12;
  return `${String(h).padStart(2, '0')}${String(total % 60).padStart(2, '0')}`;
};
const sortIds = (rows, valueCol, dir) => [...rows]
  .sort((a, b) => (dir === 'asc' ? 1 : -1) * (Number(a[valueCol]) - Number(b[valueCol])))
  .map((r) => r[0]);
const byIdDesc = (rows) => rows.map((r) => r[0]).sort((a, b) => Number(b) - Number(a)).join('-');

const MOVES = { north: [-1, 0], south: [1, 0], east: [0, 1], west: [0, -1] };

/** Solvers that work for any instance of a mechanic. */
const GENERIC = {
  'decode-key': (l) => l.clueB.data.tokens
    .map((t) => l.clueA.data.tokens.find((a) => a.label === t.label).value).join(''),
  caesar: (l) => {
    const { shift, direction } = l.clueB.data;
    if (!shift) return undefined;
    return shiftWord(lastLine(l.clueA), direction === 'back' ? -shift : shift);
  },
  morse: (l) => {
    expect(l.clueB.data.rows).toEqual(morseChart('').rows);
    const letterFor = Object.fromEntries(Object.entries(MORSE).map(([letter, code]) => [code, letter]));
    return lastLine(l.clueA).split(' ').map((code) => letterFor[code]).join('');
  },
  'describe-match': (l) => {
    if (l.clueA.type !== 'symbols' || l.clueB.type !== 'symbols') return undefined;
    const legend = Object.fromEntries(l.clueB.data.symbols.map((s) => [s.shape, s.label]));
    expect(new Set(Object.keys(legend)).size).toBe(l.clueB.data.symbols.length);
    const decoys = l.clueB.data.symbols.filter((s) => !l.clueA.data.symbols.some((a) => a.shape === s.shape));
    expect(decoys.length).toBeGreaterThanOrEqual(1);
    return l.clueA.data.symbols.map((s) => legend[s.shape]).join('');
  },
  'grid-lookup': (l) => {
    const marked = l.clueA.data.cells.filter((c) => c.mark);
    expect(marked).toHaveLength(1);
    expect(l.clueA.data.colLabels).toBeUndefined();
    return l.clueB.data.colLabels[marked[0].c] + l.clueB.data.rowLabels[marked[0].r];
  },
  'grid-navigation': (l) => {
    const map = l.clueB.data;
    const at = (r, c) => map.cells.find((cell) => cell.r === r && cell.c === c);
    const text = textOf(l.clueA);
    const start = map.cells.find((cell) => cell.label === text.match(/Start (?:at|on) the ([A-Z]+)/)[1]);
    let { r, c } = start;
    const moves = [...text.matchAll(/(\d+) (?:paces?|steps?|tiles?) (north|south|east|west)/g)];
    expect(moves).toHaveLength(3);
    for (const [, count, dir] of moves) {
      for (let i = 0; i < Number(count); i += 1) {
        r += MOVES[dir][0];
        c += MOVES[dir][1];
        expect(r >= 0 && r < map.rows && c >= 0 && c < map.cols).toBe(true);
      }
    }
    return at(r, c).label;
  },
  'split-riddle': (l, { pools }) => {
    const riddle = pools.riddles.find((x) => textOf(l.clueA).includes(x.partA) && textOf(l.clueB).includes(x.partB));
    expect(l.acceptedAnswers).toEqual(riddle.acceptedAnswers);
    return riddle.answer;
  },
  'fragment-finale': (l, { levels, template }) => {
    const text = textOf(l.clueA);
    const order = levels.slice(0, 4).filter((p) => text.includes(p.title))
      .sort((a, b) => text.indexOf(a.title) - text.indexOf(b.title));
    expect(order).toHaveLength(4);
    for (const p of levels.slice(0, 4)) expect(textOf(l.clueB)).toContain(`${p.title}${template.params.use === 'firstLetter' ? ':' : ''}`);
    return order.map((p) => (template.params.use === 'firstLetter' ? p.reward[0] : p.reward)).join('');
  },
};

/** Solvers for levels whose rule is prose: the rule is restated here and must leave exactly the answer. */
const CUSTOM = {
  'cyber-heist:3': (l) => {
    expect(textOf(l.clueB)).toContain('highest ID to the lowest');
    return byIdDesc(rowsOf(l.clueA).filter(([, light, fan]) => fan === 'OFF' && light !== 'GREEN'));
  },
  'detective:1': (l) => {
    const reads = minutesOf(textOf(l.clueA).match(/read (\d{1,2}:\d{2})/)[1]);
    const fast = Number(textOf(l.clueB).match(/runs (\d+) minutes fast/)[1]);
    return asHHMM(reads - fast);
  },
  'detective:2': (l, { levels }) => {
    const murder = minutesOf(`${levels[0].answer.slice(0, 2)}:${levels[0].answer.slice(2)} PM`);
    const cleared = rowsOf(l.clueA)
      .filter(([, witness, from, until]) => witness !== 'nobody' && minutesOf(from) <= murder && minutesOf(until) >= murder);
    expect(cleared).toHaveLength(1);
    return cleared[0][0];
  },
  'detective:3': (l) => {
    const cm = textOf(l.clueA).match(/(\d+) cm/)[1];
    return rowsOf(l.clueB).find(([length]) => length === `${cm} cm`)[1];
  },
  'detective:4': (l, { pools }) => {
    // The register is the weapons pool; the wound shares the most words with exactly one mark.
    expect(rowsOf(l.clueB)).toEqual(pools.weapons.map((w) => [w.name, w.mark]));
    const words = (s) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5));
    const wound = words(textOf(l.clueA));
    const scored = rowsOf(l.clueB).map(([name, mark]) => [name, [...words(mark)].filter((w) => wound.has(w)).length])
      .sort((a, b) => b[1] - a[1]);
    expect(scored[0][1]).toBeGreaterThan(scored[1][1]);
    return scored[0][0];
  },
  'detective:5': (l, { levels }) => {
    expect(l.clueB.data.numbered).toBe(true);
    const name = shiftWord(lastLine(l.clueA), -Number(levels[2].answer));
    const suspects = rowsOf(levels[1].clueA).map((row) => row[0]);
    expect(suspects).toContain(name);
    expect(name).not.toBe(levels[1].answer); // the killer is never the cleared suspect
    return name;
  },
  'space-station:1': (l) => {
    expect(textOf(l.clueB)).toContain('lowest pressure to the highest');
    return sortIds(rowsOf(l.clueA), 1, 'asc').join('');
  },
  'pirate:4': (l) => {
    const cursed = rowsOf(l.clueA).filter(([, colour, kind]) => colour === 'GOLD' && kind === 'JEWELLERY');
    expect(cursed).toHaveLength(1);
    return cursed[0][0];
  },
  'haunted-asylum:2': (l) => {
    const winter = ['December', 'January', 'February'];
    const beds = rowsOf(l.clueB).filter(([, month, discharged, window]) => winter.includes(month) && discharged === 'No' && window === 'Yes');
    expect(beds).toHaveLength(1);
    return beds[0][0];
  },
  'haunted-asylum:4': (l) => {
    expect(textOf(l.clueB)).toContain('newest portrait to the oldest');
    return sortIds(rowsOf(l.clueA), 1, 'desc').join('');
  },
  'sun-king-tomb:3': (l) => {
    const reads = minutesOf(textOf(l.clueA).match(/points to (\d{1,2}:\d{2})/)[1]);
    const behind = Number(textOf(l.clueB).match(/runs (\d+) minutes behind/)[1]);
    return asHHMM(reads + behind);
  },
  'alchemist-tower:1': (l) => {
    expect(textOf(l.clueB)).toContain('highest bottle number to the lowest');
    return byIdDesc(rowsOf(l.clueA).filter(([, , stopper, state]) => stopper === 'CORK' && state === 'BUBBLING'));
  },
  'alchemist-tower:3': (l) => {
    expect(textOf(l.clueB)).toContain('heaviest to the lightest');
    return sortIds(rowsOf(l.clueA), 1, 'desc').join('');
  },
  'polar-expedition:3': (l) => {
    expect(textOf(l.clueB)).toContain('highest crate number to the lowest');
    return byIdDesc(rowsOf(l.clueA).filter(([, seal, kg, stencil]) => seal === 'INTACT' && Number(kg) < 20 && stencil === 'FOOD'));
  },
  'polar-expedition:4': (l) => {
    const reads = Number(textOf(l.clueA).match(/reads (\d+) litres/)[1]);
    const high = Number(textOf(l.clueB).match(/(\d+) litres too high/)[1]);
    return String(reads - high);
  },
};

test.each(LEVELS)('%s: solving the clues gives the answer', (_, slug, template, level, content) => {
  const solve = CUSTOM[`${slug}:${template.order}`] || GENERIC[template.mechanic];
  const solved = solve(level, { levels: content.levels, template, pools: content.pools });
  expect(solved).toBeDefined();
  expect(norm(solved, level.answerKind)).toBe(level.answer);
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
