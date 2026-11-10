/**
 * Alchemist's Tower – The Midnight Elixir (new theme, fantasy; docs/themed-puzzle-sets.md §4.7).
 * Uses only existing mechanics: Rule Filter, Caesar Cipher (forward variant), Ordering, Grid Lookup, Fragment Finale.
 */
const theme = {
  slug: 'alchemist-tower',
  name: "Alchemist's Tower – The Midnight Elixir",
  genre: 'Fantasy',
  story:
    'Your master, the old alchemist, has fallen under a sleeping curse. Only the Midnight Elixir can wake him, and it '
    + 'must be brewed before the tower bell strikes twelve. The Apprentice works at the bench among the shelves and '
    + 'runes. The Grimoire Keeper reads from the spellbook. You have 15 minutes.',
  timerMinutes: 15,
  styleKey: 'arcane',
  boardLabel: 'Runes',
  roles: {
    A: { name: 'Apprentice', description: 'At the workbench. You see the potion shelf, the rune lock, the scales and the spellbook pages.' },
    B: { name: 'Grimoire Keeper', description: 'You hold the grimoire: recipes, the rune key, the brewing order and the page index.' },
  },
  revealText: 'The elixir glows silver as the bell strikes twelve. Your master opens his eyes and smiles.',
  failText: 'The bell tolls midnight and the cauldron turns to ash. The curse holds.',
};

const templates = [
  {
    order: 1,
    title: 'Potion Shelf',
    mechanic: 'rule-filter',
    timeEstimateSec: 150,
    params: { items: 6, attributes: ['colour', 'stopper', 'state'], conditions: 2, answerCount: [2, 3], sortDirection: ['desc', 'asc'] },
    hint: 'A potion must meet both conditions in the recipe.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'list',
      answer: '6-4-1',
      acceptedAnswers: [],
      reward: 'O',
      clueA: {
        type: 'table',
        data: {
          caption: 'The potion shelf',
          columns: ['Bottle', 'Colour', 'Stopper', 'State'],
          rows: [
            ['1', 'GREEN', 'CORK', 'BUBBLING'],
            ['2', 'BLUE', 'WAX', 'STILL'],
            ['3', 'GREEN', 'WAX', 'BUBBLING'],
            ['4', 'RED', 'CORK', 'BUBBLING'],
            ['5', 'GREEN', 'CORK', 'STILL'],
            ['6', 'BLUE', 'CORK', 'BUBBLING'],
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Recipe, step one: take every potion that is BUBBLING and sealed with CORK.',
            'Pour them from the highest bottle number to the lowest. Enter the numbers separated by dashes, like 9-5-1.',
          ],
        },
      },
      explanation: 'Bottles 1, 4 and 6 are bubbling with a cork: 6-4-1.',
    },
  },
  {
    order: 2,
    title: 'Rune Lock',
    mechanic: 'caesar',
    timeEstimateSec: 150,
    params: { pool: 'caesarWords', shift: [2, 9], direction: 'forward' },
    hint: 'Find each carved rune-letter in the top row of the key. The letter under it is the true one.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'word',
      answer: 'MANDRAKE',
      acceptedAnswers: [],
      reward: 'T',
      clueA: { type: 'text', data: { paragraphs: ['Letters glowing on the locked ingredient cabinet:', 'IWJZNWGA'] } },
      clueB: { type: 'strip', data: { caption: 'The rune key: move every letter forward by 4 places.', shift: 4, direction: 'forward' } },
      explanation: 'IWJZNWGA moved forward by 4 is MANDRAKE.',
    },
  },
  {
    order: 3,
    title: 'Alchemy Scales',
    mechanic: 'ordering',
    timeEstimateSec: 120,
    params: { items: 4, valueRange: [40, 400], distinct: true, direction: ['desc', 'asc'], output: 'jar numbers as one code' },
    hint: 'Weigh first, then read off the jar numbers in order.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: '2795',
      acceptedAnswers: [],
      reward: 'E',
      clueA: {
        type: 'table',
        data: {
          caption: 'Ingredient jars on the scales',
          columns: ['Jar', 'Weight (g)'],
          rows: [['2', '340'], ['5', '75'], ['7', '210'], ['9', '125']],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Recipe, step three: add the ingredients from the heaviest to the lightest.',
            'Enter the jar numbers in that order as one code.',
          ],
        },
      },
      explanation: 'Heaviest to lightest: jar 2 (340 g), 7 (210 g), 9 (125 g), 5 (75 g) gives 2795.',
    },
  },
  {
    order: 4,
    title: 'Spellbook Index',
    mechanic: 'grid-lookup',
    timeEstimateSec: 120,
    params: { rows: 4, cols: 4, colLabels: 'distinct letters', rowLabels: 'distinct digits 1–9' },
    hint: 'Describe where the glowing rune is by counting rows and columns from one corner.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: 'Q3',
      acceptedAnswers: [],
      reward: 'M',
      clueA: {
        type: 'grid',
        data: {
          caption: 'The spellbook falls open on a page of runes. One rune is glowing. (Top of the grid is the top of the page.)',
          rows: 4,
          cols: 4,
          cells: [{ r: 3, c: 2, mark: 'rune' }],
        },
      },
      clueB: {
        type: 'grid',
        data: {
          caption: 'The grimoire index. Enter the column letter, then the row number.',
          rows: 4,
          cols: 4,
          colLabels: ['H', 'D', 'Q', 'M'],
          rowLabels: ['6', '1', '8', '3'],
          cells: [],
        },
      },
      explanation: 'The rune is in the 3rd column (Q) and 4th row (3): Q3.',
    },
  },
  {
    order: 5,
    title: 'The Elixir',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { pool: 'finaleWords', rewards: 'letters', use: 'reward' },
    hint: 'The runes are also on your board.',
    rewardRule: null,
    fallback: {
      answerKind: 'word',
      answer: 'TOME',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The cauldron lid bears four empty rune slots. Fill them in this order:',
            'Rune Lock, Potion Shelf, Spellbook Index, Alchemy Scales.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Runes gathered so far:',
            'Potion Shelf: O. Rune Lock: T. Alchemy Scales: E. Spellbook Index: M.',
          ],
        },
      },
      explanation: 'T, O, M, E in that order spells TOME.',
    },
  },
];

const pools = {
  caesarWords: ['DRAGON', 'ELIXIR', 'WYVERN', 'GOLEM', 'MANDRAKE', 'PHOENIX', 'GRIFFIN', 'UNICORN', 'WIZARD', 'POTION', 'CAULDRON', 'BASILISK'],
  finaleWords: ['TOME', 'RUNE', 'WAND', 'SAGE', 'MAGE', 'BREW', 'MOON', 'OWLS'],
};

module.exports = { theme, templates, pools };
