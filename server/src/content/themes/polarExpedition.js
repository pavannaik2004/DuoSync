/**
 * Polar Expedition – Whiteout at Camp Aurora (new theme, survival; docs/themed-puzzle-sets.md §4.8).
 * Uses only existing mechanics: Grid Navigation, Morse, Rule Filter, Arithmetic Split, Fragment Finale.
 */
const { toMorse, morseChart } = require('../catalog');

const theme = {
  slug: 'polar-expedition',
  name: 'Polar Expedition – Whiteout at Camp Aurora',
  genre: 'Survival',
  story:
    'A blizzard has buried Camp Aurora, and the rescue plane can only land if you send it the right frequency. The '
    + 'Navigator is out on the ice in the storm. The Radio Operator is in the base hut with the map, the charts and '
    + 'the manifest. The plane turns back in 18 minutes.',
  timerMinutes: 18,
  styleKey: 'polar',
  boardLabel: 'Frequency digits',
  roles: {
    A: { name: 'Navigator', description: 'Out on the ice. You follow the trail, hear the radio static, check the crates and read the fuel gauge.' },
    B: { name: 'Radio Operator', description: 'In the base hut with the camp map, the Morse chart, the supply manifest rules and the fuel tables.' },
  },
  revealText: 'Landing lights cut through the snow. The rescue plane touches down at Camp Aurora. Everyone goes home.',
  failText: 'The plane circles once, then turns back into the storm. Camp Aurora waits for spring.',
};

const templates = [
  {
    order: 1,
    title: 'Whiteout Walk',
    mechanic: 'grid-navigation',
    timeEstimateSec: 150,
    params: { unit: ['step', 'steps'], copy: { introA: 'You can barely see your own boots. Your compass notes say:', startLine: 'Start at the {landmark}.', moveLine: 'Walk {count} {unit} {direction}.' }, rows: 5, cols: 5, pool: 'landmarks', landmarks: 7, moves: 3, stayOnMap: true, endOnLandmark: true },
    hint: 'North is the top of the map. Trace each move one square at a time.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'word',
      answer: 'CAIRN',
      acceptedAnswers: [],
      reward: '3',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'You can barely see your own boots. Your compass notes say:',
            'Start at the FLAGPOLE.',
            'Walk 3 steps south.',
            'Walk 2 steps west.',
            'Walk 1 step north.',
          ],
        },
      },
      clueB: {
        type: 'grid',
        data: {
          caption: 'Camp map. North is the top. One square is one step.',
          rows: 5,
          cols: 5,
          cells: [
            { r: 0, c: 0, label: 'RIDGE' },
            { r: 0, c: 3, label: 'FLAGPOLE' },
            { r: 1, c: 4, label: 'CREVASSE' },
            { r: 2, c: 1, label: 'CAIRN' },
            { r: 2, c: 4, label: 'DEPOT' },
            { r: 4, c: 0, label: 'IGLOO' },
            { r: 4, c: 4, label: 'HUT' },
          ],
        },
      },
      explanation: 'From the FLAGPOLE: 3 south, 2 west, 1 north reaches the CAIRN.',
    },
  },
  {
    order: 2,
    title: 'Radio Static',
    mechanic: 'morse',
    timeEstimateSec: 150,
    params: { copy: { introA: 'Through the static, a weak beeping. Letters are separated by spaces:' }, pool: 'morseWords' },
    hint: 'Each group of beeps is one letter. Read them left to right.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'word',
      answer: 'FROST',
      acceptedAnswers: [],
      reward: '8',
      clueA: {
        type: 'text',
        data: { paragraphs: ['Through the static, a weak beeping. Letters are separated by spaces:', toMorse('FROST')] },
      },
      clueB: { type: 'table', data: morseChart('Morse chart pinned above the radio') },
      explanation: '..-. .-. --- ... - is FROST.',
    },
  },
  {
    order: 3,
    title: 'Supply Crates',
    mechanic: 'rule-filter',
    timeEstimateSec: 180,
    params: { items: 6, idRange: [1, 20], attributes: ['seal', 'weight', 'stencil'], conditions: 3, answerCount: 3, sortDirection: ['desc', 'asc'] },
    hint: 'A crate must pass all three checks in the manifest rules.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'list',
      answer: '14-9-2',
      acceptedAnswers: [],
      reward: '6',
      clueA: {
        type: 'table',
        data: {
          caption: 'Crates half-buried by the depot',
          columns: ['Crate', 'Seal', 'Weight (kg)', 'Stencil'],
          rows: [
            ['2', 'INTACT', '12', 'FOOD'],
            ['5', 'BROKEN', '8', 'FOOD'],
            ['9', 'INTACT', '18', 'FOOD'],
            ['11', 'INTACT', '25', 'FOOD'],
            ['14', 'INTACT', '6', 'FOOD'],
            ['16', 'INTACT', '9', 'FUEL'],
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Manifest rules: only bring in crates whose seal is INTACT, that weigh under 20 kg, and that are stencilled FOOD.',
            'Call them in from the highest crate number to the lowest, separated by dashes, like 9-5-1.',
          ],
        },
      },
      solution: {table: 'A', where: [{col: 1, op: 'eq', value: 'INTACT'}, {col: 2, op: 'lt', value: 20}, {col: 3, op: 'eq', value: 'FOOD'}], pick: 0, sort: 'desc', join: true},
      explanation: 'Crates 2, 9 and 14 are intact, under 20 kg and hold food: 14-9-2.',
    },
  },
  {
    order: 4,
    title: 'Fuel Gauge',
    mechanic: 'arithmetic',
    timeEstimateSec: 120,
    params: { reading: 'number', readingRange: [200, 480], step: 5, correction: [15, 60], correctionDirection: 'subtract' },
    hint: 'A gauge that reads too high shows more fuel than there really is.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: '295',
      acceptedAnswers: [],
      reward: '1',
      clueA: {
        type: 'text',
        data: { paragraphs: ["The generator's frosted fuel gauge reads 340 litres."] },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            "Engineer's note: in deep cold this gauge reads 45 litres too high.",
            'Enter the true amount of fuel in litres.',
          ],
        },
      },
      solution: {reading: '340', delta: -45, format: 'number'},
      explanation: 'The gauge reads 340 and is 45 too high, so there are 295 litres.',
    },
  },
  {
    order: 5,
    title: 'Rescue Flare',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { rewards: 'distinct digits 1–9', use: 'reward' },
    hint: 'The frequency digits are also on your board.',
    rewardRule: null,
    fallback: {
      answerKind: 'code',
      answer: '1368',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'Tune the rescue radio to the digits from these, in this order:',
            'Fuel Gauge, Whiteout Walk, Supply Crates, Radio Static.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Frequency digits logged so far:',
            'Whiteout Walk gave 3. Radio Static gave 8. Supply Crates gave 6. Fuel Gauge gave 1.',
          ],
        },
      },
      explanation: 'Fuel Gauge 1, Whiteout Walk 3, Supply Crates 6, Radio Static 8 gives 1368.',
    },
  },
];

const pools = {
  morseWords: ['SNOW', 'BLIZZARD', 'RESCUE', 'HUSKY', 'FROST', 'GLACIER', 'AURORA', 'SLED', 'ICEBERG', 'TUNDRA'],
  /** Whiteout Walk landmarks. */
  landmarks: ['FLAGPOLE', 'CAIRN', 'HUT', 'RIDGE', 'IGLOO', 'DEPOT', 'CREVASSE', 'BEACON'],
};

module.exports = { theme, templates, pools };
