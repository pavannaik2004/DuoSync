/**
 * Tomb of the Sun King – The Golden Mask (new theme, ancient myth; docs/themed-puzzle-sets.md §4.6).
 * Uses only existing mechanics: Describe and Match, Decode and Key, Arithmetic Split, Grid Navigation, Fragment Finale.
 */
const theme = {
  slug: 'sun-king-tomb',
  name: 'Tomb of the Sun King – The Golden Mask',
  genre: 'Ancient myth',
  story:
    'Deep under the desert lies the sealed tomb of the Sun King, and his golden mask has never been seen. The Explorer '
    + 'has crawled inside with a torch. The Scholar waits at camp with the translations and the dig notes, talking '
    + 'over the radio. The torch has 18 minutes of oil left.',
  timerMinutes: 18,
  styleKey: 'tomb',
  boardLabel: 'Sacred digits',
  roles: {
    A: { name: 'Explorer', description: 'Inside the tomb by torchlight. You see the carved walls, the jars, the sundial shaft and the floor tiles.' },
    B: { name: 'Scholar', description: 'At camp on the radio, with the hieroglyph translations, the dig notes and the floor plan.' },
  },
  revealText: "The last seal cracks and sunlight floods the chamber. The Sun King's golden mask gleams in your hands.",
  failText: 'The torch sputters out. In the dark, the tomb door grinds shut behind you.',
};

const templates = [
  {
    order: 1,
    title: 'Hieroglyph Wall',
    mechanic: 'describe-match',
    timeEstimateSec: 150,
    params: { pool: 'hieroglyphWords', legend: 'letter', decoys: 2 },
    hint: 'Each glyph always stands for the same letter. Two glyphs in the translation are not on the wall.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'word',
      answer: 'SCARAB',
      acceptedAnswers: ['BEETLE'],
      reward: '4',
      clueA: {
        type: 'symbols',
        data: {
          caption: 'Carved above the first door, left to right.',
          symbols: [{ shape: 'eye' }, { shape: 'sun' }, { shape: 'wave' }, { shape: 'moon' }, { shape: 'wave' }, { shape: 'key' }],
        },
      },
      clueB: {
        type: 'symbols',
        data: {
          caption: 'Your translation table.',
          symbols: [
            { shape: 'moon', label: 'R' },
            { shape: 'crown', label: 'N' },
            { shape: 'eye', label: 'S' },
            { shape: 'key', label: 'B' },
            { shape: 'bolt', label: 'T' },
            { shape: 'wave', label: 'A' },
            { shape: 'sun', label: 'C' },
          ],
        },
      },
      explanation: 'Eye S, sun C, wave A, moon R, wave A, key B spells SCARAB.',
    },
  },
  {
    order: 2,
    title: 'Canopic Jars',
    mechanic: 'decode-key',
    timeEstimateSec: 120,
    params: { keys: 4, distinctDigits: true, labels: ['FALCON', 'JACKAL', 'BABOON', 'HUMAN'], colors: ['red', 'blue', 'green', 'yellow'], shuffleOrder: true },
    hint: "Take the jars in the Scholar's order and read the numeral painted on each.",
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: '2169',
      acceptedAnswers: [],
      reward: '7',
      clueA: {
        type: 'tokens',
        data: {
          caption: 'Four jars, each with a guardian head and a numeral painted on it.',
          tokens: [
            { label: 'FALCON', color: 'blue', value: '6' },
            { label: 'JACKAL', color: 'red', value: '2' },
            { label: 'BABOON', color: 'green', value: '9' },
            { label: 'HUMAN', color: 'yellow', value: '1' },
          ],
        },
      },
      clueB: {
        type: 'tokens',
        data: {
          caption: 'Dig notes: the priests sealed the jars in this order.',
          tokens: [
            { label: 'JACKAL', color: 'red' },
            { label: 'HUMAN', color: 'yellow' },
            { label: 'FALCON', color: 'blue' },
            { label: 'BABOON', color: 'green' },
          ],
        },
      },
      explanation: 'JACKAL 2, HUMAN 1, FALCON 6, BABOON 9 gives 2169.',
    },
  },
  {
    order: 3,
    title: 'Sundial',
    mechanic: 'arithmetic',
    timeEstimateSec: 120,
    params: { reading: 'clock', readingRange: ['01:00', '05:55'], stepMinutes: 5, errorMinutes: [15, 20, 25, 30, 35], errorDirection: 'slow', output: 'HHMM' },
    hint: 'A dial that runs behind shows an earlier time than the true one.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: '0515',
      acceptedAnswers: ['515'],
      reward: '1',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'A shaft of sunlight falls on the stone dial in the antechamber.',
            'The shadow points to 4:50.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            "The scribe's note: this dial was cut for the old calendar and runs 25 minutes behind.",
            'Enter the true time as four digits, like 0930.',
          ],
        },
      },
      solution: {reading: '4:50', delta: 25, format: 'clock'},
      explanation: 'The dial shows 4:50 and runs 25 minutes behind, so the true time is 5:15 (0515).',
    },
  },
  {
    order: 4,
    title: 'Pressure Plates',
    mechanic: 'grid-navigation',
    timeEstimateSec: 150,
    params: { rows: 5, cols: 5, pool: 'landmarks', landmarks: 7, moves: 3, stayOnMap: true, endOnLandmark: true },
    hint: 'North is the top of the floor plan. Count one tile per step.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'word',
      answer: 'COBRA',
      acceptedAnswers: ['SNAKE'],
      reward: '5',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'Painted on the wall of the corridor:',
            'Start on the FALCON.',
            'Step 2 tiles east.',
            'Step 2 tiles south.',
            'Step 1 tile west.',
          ],
        },
      },
      clueB: {
        type: 'grid',
        data: {
          caption: 'Floor plan of the corridor. North is the top. Only one tile is safe to stand on at the end.',
          rows: 5,
          cols: 5,
          cells: [
            { r: 0, c: 0, label: 'FALCON' },
            { r: 0, c: 4, label: 'IBIS' },
            { r: 1, c: 3, label: 'LOTUS' },
            { r: 2, c: 1, label: 'COBRA' },
            { r: 3, c: 4, label: 'JACKAL' },
            { r: 4, c: 0, label: 'LION' },
            { r: 4, c: 2, label: 'VULTURE' },
          ],
        },
      },
      explanation: 'From the FALCON: 2 east, 2 south, 1 west ends on the COBRA tile.',
    },
  },
  {
    order: 5,
    title: 'Mask Chamber',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { rewards: 'distinct digits 1–9', use: 'reward' },
    hint: 'The sacred digits are also on your board.',
    rewardRule: null,
    fallback: {
      answerKind: 'code',
      answer: '1547',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            "The mask's sarcophagus has a four-dial lock. Carved beneath it:",
            'Sundial, Pressure Plates, Hieroglyph Wall, Canopic Jars.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Sacred digits noted so far:',
            'Hieroglyph Wall gave 4. Canopic Jars gave 7. Sundial gave 1. Pressure Plates gave 5.',
          ],
        },
      },
      explanation: 'Sundial 1, Pressure Plates 5, Hieroglyph Wall 4, Canopic Jars 7 gives 1547.',
    },
  },
];

const pools = {
  /** Hieroglyph Wall words. Distinct letters + 2 decoys must fit the 16 glyphs. */
  hieroglyphWords: ['SCARAB', 'ANKH', 'SPHINX', 'PHARAOH', 'PYRAMID', 'OBELISK', 'LOTUS', 'NILE', 'COBRA', 'MUMMY'],
  /** Pressure Plates tile names. */
  landmarks: ['FALCON', 'IBIS', 'LOTUS', 'COBRA', 'JACKAL', 'LION', 'VULTURE', 'BEETLE'],
  /** Canopic Jars guardians (labels for the tokens). */
  guardians: ['FALCON', 'JACKAL', 'BABOON', 'HUMAN'],
};

module.exports = { theme, templates, pools };
