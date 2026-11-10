/**
 * Space Station – Station Helios Emergency (PRD §6.5; docs/themed-puzzle-sets.md §4.3).
 */
const { toMorse, morseChart } = require('../catalog');

const theme = {
  slug: 'space-station',
  name: 'Space Station – Station Helios Emergency',
  genre: 'Sci-fi',
  story:
    'A solar flare has crippled Station Helios. Oxygen is leaking, the navigation computer is dark and the last '
    + 'escape pod is locked. The Engineer is aboard, working the controls by hand. Mission Control is on the radio '
    + 'with the manuals and charts. The air runs out in 15 minutes.',
  timerMinutes: 15,
  styleKey: 'orbital',
  boardLabel: 'Launch digits',
  roles: {
    A: { name: 'Engineer', description: 'Aboard Helios. You see the valves, the star window, the cables and the radio signal.' },
    B: { name: 'Mission Control', description: 'On Earth with the manuals: valve procedure, star charts, wiring plans and the Morse chart.' },
  },
  revealText: 'The pod clears the station seconds before the hull gives way. Helios crew, welcome home.',
  failText: 'The oxygen alarm falls silent. Station Helios drifts on without a crew.',
};

const templates = [
  {
    order: 1,
    title: 'Oxygen Valves',
    mechanic: 'ordering',
    timeEstimateSec: 120,
    params: { items: 4, valueRange: [60, 220], distinct: true, direction: ['asc', 'desc'], output: 'item ids as one code' },
    hint: 'Compare the pressures, then read the valve numbers in the order Mission Control asks for.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: '2431',
      acceptedAnswers: [],
      reward: '7',
      clueA: {
        type: 'table',
        data: {
          caption: 'Valve pressure readings',
          columns: ['Valve', 'Pressure (kPa)'],
          rows: [['1', '184'], ['2', '97'], ['3', '142'], ['4', '121']],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Emergency procedure: open the valves from the lowest pressure to the highest.',
            'Enter the valve numbers in that order as one code.',
          ],
        },
      },
      solution: {table: 'A', idCol: 0, valueCol: 1, direction: 'asc'},
      explanation: 'Lowest to highest: valve 2 (97), 4 (121), 3 (142), 1 (184) gives 2431.',
    },
  },
  {
    order: 2,
    title: 'Star Map',
    mechanic: 'grid-lookup',
    timeEstimateSec: 120,
    params: { rows: 4, cols: 4, colLabels: 'distinct letters', rowLabels: 'distinct digits 1–9' },
    hint: 'Describe where the beacon is by counting rows and columns from one corner.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: 'B9',
      acceptedAnswers: [],
      reward: '3',
      clueA: {
        type: 'grid',
        data: {
          caption: 'The star window. One star is flashing: the rescue beacon. (Top of the grid is the top of the window.)',
          rows: 4,
          cols: 4,
          cells: [{ r: 2, c: 1, mark: 'star' }],
        },
      },
      clueB: {
        type: 'grid',
        data: {
          caption: 'Star chart labels. Enter the column letter, then the row number.',
          rows: 4,
          cols: 4,
          colLabels: ['K', 'B', 'R', 'F'],
          rowLabels: ['7', '2', '9', '4'],
          cells: [],
        },
      },
      explanation: 'The beacon is in the 2nd column (B) and 3rd row (9): B9.',
    },
  },
  {
    order: 3,
    title: 'Power Routing',
    mechanic: 'decode-key',
    timeEstimateSec: 120,
    params: { keys: 4, distinctDigits: true, colors: ['red', 'blue', 'green', 'yellow', 'orange', 'purple'], shuffleOrder: true },
    hint: "Follow Mission Control's cable order and read each cable's port number.",
    rewardRule: 'digit',
    fallback: {
      answerKind: 'code',
      answer: '4681',
      acceptedAnswers: [],
      reward: '9',
      clueA: {
        type: 'tokens',
        data: {
          caption: 'Loose cables and the port each one reaches.',
          tokens: [
            { label: 'ORANGE', color: 'orange', value: '6' },
            { label: 'PURPLE', color: 'purple', value: '1' },
            { label: 'RED', color: 'red', value: '8' },
            { label: 'BLUE', color: 'blue', value: '4' },
          ],
        },
      },
      clueB: {
        type: 'tokens',
        data: {
          caption: 'Wiring plan: connect the cables in this order. The code is their port numbers.',
          tokens: [
            { label: 'BLUE', color: 'blue' },
            { label: 'ORANGE', color: 'orange' },
            { label: 'RED', color: 'red' },
            { label: 'PURPLE', color: 'purple' },
          ],
        },
      },
      explanation: 'BLUE 4, ORANGE 6, RED 8, PURPLE 1 gives 4681.',
    },
  },
  {
    order: 4,
    title: 'Distress Signal',
    mechanic: 'morse',
    timeEstimateSec: 150,
    params: { pool: 'morseWords' },
    hint: 'Each group of dots and dashes is one letter. Read them left to right.',
    rewardRule: 'digit',
    fallback: {
      answerKind: 'word',
      answer: 'MAYDAY',
      acceptedAnswers: [],
      reward: '5',
      clueA: {
        type: 'text',
        data: { paragraphs: ['The radio repeats this signal. Letters are separated by spaces.', toMorse('MAYDAY')] },
      },
      clueB: { type: 'table', data: morseChart('Morse chart') },
      explanation: '-- .- -.-- -.. .- -.-- is MAYDAY.',
    },
  },
  {
    order: 5,
    title: 'Escape Pod Launch',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { rewards: 'distinct digits 1–9', use: 'reward' },
    hint: 'The launch digits are also on your team board.',
    rewardRule: null,
    fallback: {
      answerKind: 'code',
      answer: '5793',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The pod launch code is the digits from these systems, in this order:',
            'Distress Signal, Oxygen Valves, Power Routing, Star Map.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Digits logged so far:',
            'Oxygen Valves gave 7. Star Map gave 3. Power Routing gave 9. Distress Signal gave 5.',
          ],
        },
      },
      explanation: 'Distress Signal 5, Oxygen Valves 7, Power Routing 9, Star Map 3 gives 5793.',
    },
  },
];

const pools = {
  /** Distress Signal (EARTH, HELP, MAYDAY…). */
  morseWords: ['EARTH', 'HELP', 'MAYDAY', 'RESCUE', 'ORBIT', 'DANGER', 'SIGNAL', 'COMET', 'OXYGEN', 'ROCKET'],
};

module.exports = { theme, templates, pools };
