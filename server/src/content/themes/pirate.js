/**
 * Pirate – Blackbeard's Lost Treasure (PRD §6.5; docs/themed-puzzle-sets.md §4.4).
 * Captain's Password: the generator picks a finale word first, then answers for levels 1–4 whose
 * first letters spell it in a random order. Every finale word must be spellable from the pools
 * below; the content tests check this.
 */
const theme = {
  slug: 'pirate',
  name: "Pirate – Blackbeard's Lost Treasure",
  genre: 'Adventure',
  story:
    "Blackbeard's map has led you to a nameless island, and the tide is coming in. The Deckhand is ashore with the torn "
    + "parchment, the compass and the chest. The Navigator stays aboard with the charts, the cipher legend and the "
    + "captain's log. You have 18 minutes before the sea takes the beach.",
  timerMinutes: 18,
  styleKey: 'pirate',
  boardLabel: 'Treasure log',
  roles: {
    A: { name: 'Deckhand', description: 'Ashore. You hold the torn parchment, walk the island, and open the chests.' },
    B: { name: 'Navigator', description: "Aboard ship with the island chart, the cipher legend and the captain's log." },
  },
  revealText: "The chest creaks open on a hoard of gold. Blackbeard's treasure is yours.",
  failText: 'The tide swallows the beach. The treasure sleeps on beneath the waves.',
};

const templates = [
  {
    order: 1,
    title: 'Torn Parchment',
    mechanic: 'split-riddle',
    timeEstimateSec: 120,
    params: { pool: 'riddles', firstLetterFor: 'answer.5' },
    hint: 'Read both halves aloud as one riddle.',
    rewardRule: 'answer',
    fallback: {
      answerKind: 'word',
      answer: 'MAP',
      acceptedAnswers: ['CHART'],
      reward: 'MAP',
      clueA: { type: 'text', data: { paragraphs: ['The top half of the parchment reads:', 'I have cities, but no houses;'] } },
      clueB: {
        type: 'text',
        data: { paragraphs: ['The bottom half is in the captain\'s log:', 'forests, but no trees; and water, but no fish. What am I?'] },
      },
      explanation: 'Cities without houses, forests without trees, water without fish: a MAP.',
    },
  },
  {
    order: 2,
    title: 'Island Walk',
    mechanic: 'grid-navigation',
    timeEstimateSec: 150,
    params: { rows: 5, cols: 5, pool: 'landmarks', landmarks: 7, moves: 3, stayOnMap: true, endOnLandmark: true, firstLetterFor: 'answer.5' },
    hint: 'North is the top of the chart. Trace each move one square at a time.',
    rewardRule: 'answer',
    fallback: {
      answerKind: 'word',
      answer: 'SKULL',
      acceptedAnswers: [],
      reward: 'SKULL',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'Scratched on a coconut shell:',
            'Start at the PALM.',
            'Walk 2 paces north.',
            'Walk 3 paces east.',
            'Walk 1 pace south.',
          ],
        },
      },
      clueB: {
        type: 'grid',
        data: {
          caption: 'Island chart. North is the top. One square is one pace.',
          rows: 5,
          cols: 5,
          cells: [
            { r: 0, c: 1, label: 'WELL' },
            { r: 0, c: 4, label: 'VOLCANO' },
            { r: 1, c: 2, label: 'DUNE' },
            { r: 1, c: 4, label: 'LAGOON' },
            { r: 3, c: 1, label: 'WRECK' },
            { r: 3, c: 3, label: 'SKULL' },
            { r: 4, c: 0, label: 'PALM' },
            { r: 4, c: 4, label: 'CAVE' },
          ],
        },
      },
      explanation: 'From the PALM: 2 north, 3 east, 1 south lands on SKULL rock.',
    },
  },
  {
    order: 3,
    title: 'Pirate Code',
    mechanic: 'describe-match',
    timeEstimateSec: 150,
    params: { pool: 'codeWords', legend: 'letter', decoys: 2, firstLetterFor: 'answer.5' },
    hint: 'The same symbol always stands for the same letter.',
    rewardRule: 'answer',
    fallback: {
      answerKind: 'word',
      answer: 'PARROT',
      acceptedAnswers: [],
      reward: 'PARROT',
      clueA: {
        type: 'symbols',
        data: {
          caption: 'Carved on the cave wall, left to right.',
          symbols: [{ shape: 'anchor' }, { shape: 'moon' }, { shape: 'key' }, { shape: 'key' }, { shape: 'sun' }, { shape: 'cross' }],
        },
      },
      clueB: {
        type: 'symbols',
        data: {
          caption: "Blackbeard's cipher legend.",
          symbols: [
            { shape: 'key', label: 'R' },
            { shape: 'wave', label: 'E' },
            { shape: 'anchor', label: 'P' },
            { shape: 'cross', label: 'T' },
            { shape: 'crown', label: 'S' },
            { shape: 'moon', label: 'A' },
            { shape: 'sun', label: 'O' },
          ],
        },
      },
      explanation: 'Anchor P, moon A, key R, key R, sun O, cross T spells PARROT.',
    },
  },
  {
    order: 4,
    title: 'Cursed Chest',
    mechanic: 'rule-filter',
    timeEstimateSec: 120,
    params: { pool: 'chestItems', items: 5, attributes: ['colour', 'kind'], ruleVariants: ['colour+kind', 'colour+not kind', 'not colour+kind'], answerCount: 1, firstLetterFor: 'answer.5' },
    hint: 'The rule has two conditions. Only one item meets both.',
    rewardRule: 'answer',
    fallback: {
      answerKind: 'word',
      answer: 'AMULET',
      acceptedAnswers: [],
      reward: 'AMULET',
      clueA: {
        type: 'table',
        data: {
          caption: 'Inside the chest',
          columns: ['Item', 'Colour', 'Kind'],
          rows: [
            ['GOBLET', 'GOLD', 'CUP'],
            ['PEARL', 'WHITE', 'JEWELLERY'],
            ['AMULET', 'GOLD', 'JEWELLERY'],
            ['CROWN', 'SILVER', 'JEWELLERY'],
            ['MEDAL', 'BRONZE', 'COIN'],
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            "From the captain's log: 'One piece carries my curse. It is GOLD, and it is JEWELLERY.'",
            'Enter the name of the cursed item.',
          ],
        },
      },
      explanation: 'The only gold piece of jewellery is the AMULET.',
    },
  },
  {
    order: 5,
    title: "Captain's Password",
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { pool: 'finaleWords', rewards: 'answers', use: 'firstLetter' },
    hint: 'Take only the first letter of each answer on your board.',
    rewardRule: null,
    fallback: {
      answerKind: 'word',
      answer: 'MAPS',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            "The captain's password is the first letters of these answers, in this order:",
            'Torn Parchment, Cursed Chest, Pirate Code, Island Walk.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            "Answers written in the captain's log:",
            'Torn Parchment: MAP. Island Walk: SKULL. Pirate Code: PARROT. Cursed Chest: AMULET.',
          ],
        },
      },
      explanation: 'MAP, AMULET, PARROT, SKULL: the first letters spell MAPS.',
    },
  },
];

const pools = {
  /** Torn Parchment: the PRD asks for 6+. */
  riddles: [
    { partA: 'I have cities, but no houses;', partB: 'forests, but no trees; and water, but no fish. What am I?', answer: 'MAP', acceptedAnswers: ['CHART'] },
    { partA: 'I have an eye, but I cannot see;', partB: 'every sailor mends his sails with me. What am I?', answer: 'NEEDLE', acceptedAnswers: [] },
    { partA: 'I run, but I never walk; I have a mouth, but never talk;', partB: 'I have a bed, but I never sleep. What am I?', answer: 'RIVER', acceptedAnswers: ['STREAM'] },
    { partA: 'I have a neck, but no head;', partB: 'I wear a cork for a cap and carry rum for the crew. What am I?', answer: 'BOTTLE', acceptedAnswers: [] },
    { partA: 'The more of me you take,', partB: 'the more of me you leave behind you on the sand. What am I?', answer: 'STEPS', acceptedAnswers: ['FOOTSTEP', 'TRACKS'] },
    { partA: 'Feed me and I grow; give me a drink', partB: 'and I die. Every cook on board needs me. What am I?', answer: 'FIRE', acceptedAnswers: ['FLAME'] },
    { partA: 'I have a head and a tail,', partB: 'but no body, and pirates bury me by the chestful. What am I?', answer: 'COIN', acceptedAnswers: ['DOUBLOON'] },
    { partA: 'I am lighter than a feather,', partB: 'yet the strongest pirate cannot hold me for long. What am I?', answer: 'BREATH', acceptedAnswers: [] },
    { partA: 'I hang from the bow and never sail;', partB: 'drop me, and the ship stays put. What am I?', answer: 'ANCHOR', acceptedAnswers: [] },
    { partA: 'Turn me on my side and I am everything;', partB: 'cut me in half and I am nothing. What number am I?', answer: 'EIGHT', acceptedAnswers: ['8'] },
  ],
  /** Island Walk landmarks: 7 are placed on the 5 × 5 chart per game. */
  landmarks: ['PALM', 'SKULL', 'WELL', 'VOLCANO', 'LAGOON', 'DUNE', 'WRECK', 'EAGLE', 'CAVE'],
  /** Pirate Code (CANNON, PARROT, SAILOR…). Distinct letters + 2 decoys must fit the 16 glyphs. */
  codeWords: ['CANNON', 'PARROT', 'SAILOR', 'MAST', 'OCEAN', 'DECK', 'ROPE', 'ANCHOR', 'VOYAGE', 'GALLEON', 'COMPASS'],
  /** Cursed Chest items. */
  chestItems: ['AMULET', 'GOBLET', 'PEARL', 'CROWN', 'MEDAL', 'EMERALD', 'DIAMOND', 'OPAL', 'SILVER', 'RUBY'],
  /** Captain's Password (CAVE, COVE, CODE, MAPS…). */
  finaleWords: ['CAVE', 'COVE', 'CODE', 'MAPS', 'ROPE', 'WAVE', 'SAND'],
};

module.exports = { theme, templates, pools };
