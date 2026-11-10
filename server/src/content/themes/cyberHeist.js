/**
 * Cyber Heist – Operation Blackout (PRD §6.5; docs/themed-puzzle-sets.md §4.1).
 * The fallback values are the Phase 2 fixed set (DECISIONS D33). Answers never leave the server.
 */
const theme = {
  slug: 'cyber-heist',
  name: 'Cyber Heist – Operation Blackout',
  genre: 'Tech heist',
  story:
    'A rival firm has locked its vault behind five layers of security. The Hacker is inside the network '
    + 'and sees the raw signals. The Decoder holds the manuals that make sense of them. '
    + 'You have 15 minutes before the system resets.',
  timerMinutes: 15,
  styleKey: 'cyber',
  boardLabel: 'Fragments',
  roles: {
    A: { name: 'Hacker', description: 'Inside the network. You see the raw signals: keypads, codes and readouts.' },
    B: { name: 'Decoder', description: 'You hold the manuals: the rules and keys that make sense of the signals.' },
  },
  revealText: 'The vault door swings open. Operation Blackout is a success.',
  failText: 'The system reset before you got in. The vault stays locked.',
};

const templates = [
  {
    order: 1,
    title: 'Access PIN',
    mechanic: 'decode-key',
    timeEstimateSec: 120,
    params: { labels: 'colors', copy: { captionA: 'The keypad shows four lit keys.', captionB: 'Key the colours in this order.' }, keys: 4, distinctDigits: true, colors: ['red', 'blue', 'green', 'yellow'], shuffleOrder: true },
    hint: "Read each colour in the Decoder's order and take its digit from the Hacker's keypad.",
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: '9742',
      acceptedAnswers: [],
      reward: 'D',
      clueA: {
        type: 'tokens',
        data: {
          caption: 'The keypad shows four lit keys.',
          tokens: [
            { label: 'RED', color: 'red', value: '7' },
            { label: 'BLUE', color: 'blue', value: '2' },
            { label: 'GREEN', color: 'green', value: '9' },
            { label: 'YELLOW', color: 'yellow', value: '4' },
          ],
        },
      },
      clueB: {
        type: 'tokens',
        data: {
          caption: 'Key the colours in this order.',
          tokens: [
            { label: 'GREEN', color: 'green' },
            { label: 'RED', color: 'red' },
            { label: 'YELLOW', color: 'yellow' },
            { label: 'BLUE', color: 'blue' },
          ],
        },
      },
      explanation: 'GREEN 9, RED 7, YELLOW 4, BLUE 2 gives 9742.',
    },
  },
  {
    order: 2,
    title: 'Firewall',
    mechanic: 'caesar',
    timeEstimateSec: 150,
    params: { copy: { introA: 'Intercepted password from the security gateway:', stripCaption: 'Shift every letter back by {shift} {places}.' }, pool: 'caesarWords', shift: [1, 5], direction: 'back' },
    hint: 'Find each intercepted letter in the top row of the strip. The letter under it is the real one.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'word',
      answer: 'FIREWALL',
      acceptedAnswers: [],
      reward: 'N',
      clueA: { type: 'text', data: { paragraphs: ['Intercepted password from the security gateway:', 'ILUHZDOO'] } },
      clueB: { type: 'strip', data: { caption: 'Shift every letter back by 3 places.', shift: 3, direction: 'back' } },
      explanation: 'ILUHZDOO shifted back by 3 is FIREWALL.',
    },
  },
  {
    order: 3,
    title: 'Server Reboot',
    mechanic: 'rule-filter',
    timeEstimateSec: 180,
    params: { variant: 'offline-servers', copy: { ruleB: 'A server is offline when its fan is OFF and its light is not GREEN.', orderB: 'Reboot the offline servers {order}. Enter the IDs separated by dashes, like {example}.', directions: { desc: { order: 'from the highest ID to the lowest', example: '9-5-1' }, asc: { order: 'from the lowest ID to the highest', example: '1-5-9' } } }, items: 6, idRange: [1, 30], answerCount: 3, sortDirection: ['desc', 'asc'] },
    hint: 'Three servers are offline.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'list',
      answer: '23-12-4',
      acceptedAnswers: [],
      reward: 'E',
      clueA: {
        type: 'table',
        data: {
          caption: 'Server rack status',
          columns: ['ID', 'Light', 'Fan'],
          rows: [
            ['4', 'RED', 'OFF'],
            ['9', 'GREEN', 'OFF'],
            ['12', 'AMBER', 'OFF'],
            ['17', 'RED', 'ON'],
            ['23', 'RED', 'OFF'],
            ['28', 'GREEN', 'ON'],
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'A server is offline when its fan is OFF and its light is not GREEN.',
            'Reboot the offline servers from the highest ID to the lowest. Enter the IDs separated by dashes, like 9-5-1.',
          ],
        },
      },
      solution: {table: 'A', where: [{col: 2, op: 'eq', value: 'OFF'}, {col: 1, op: 'ne', value: 'GREEN'}], pick: 0, sort: 'desc', join: true},
      explanation: 'Servers 4, 12 and 23 are offline: 23-12-4.',
    },
  },
  {
    order: 4,
    title: 'Glyph Keypad',
    mechanic: 'describe-match',
    timeEstimateSec: 150,
    params: { variant: 'glyph-digits', copy: { captionA: 'The door panel shows these glyphs, left to right.', captionB: 'Glyph legend from the manual.' }, length: 4, shapesFrom: ['triangle', 'circle', 'square', 'diamond', 'hexagon', 'star'], decoys: [1, 2], legend: 'digit' },
    hint: 'The legend lists more glyphs than the panel shows.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: '8315',
      acceptedAnswers: [],
      reward: 'O',
      clueA: {
        type: 'symbols',
        data: {
          caption: 'The door panel shows these glyphs, left to right.',
          symbols: [{ shape: 'triangle' }, { shape: 'circle' }, { shape: 'star' }, { shape: 'square' }],
        },
      },
      clueB: {
        type: 'symbols',
        data: {
          caption: 'Glyph legend from the manual.',
          symbols: [
            { shape: 'circle', label: '3' },
            { shape: 'diamond', label: '2' },
            { shape: 'square', label: '5' },
            { shape: 'hexagon', label: '6' },
            { shape: 'triangle', label: '8' },
            { shape: 'star', label: '1' },
          ],
        },
      },
      explanation: 'Triangle 8, circle 3, star 1, square 5 gives 8315.',
    },
  },
  {
    order: 5,
    title: 'Vault Finale',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { pool: 'finaleWords', rewards: 'letters', use: 'reward', copy: { introA: "The vault opens with the four fragments, read in this order:", introB: "Fragments recovered so far:", entry: "{title} gave {value}." } },
    hint: 'The fragments are also on your team board.',
    rewardRule: null,
    fallback: {
      answerKind: 'word',
      answer: 'NODE',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The vault opens with the four fragments, read in this order:',
            'Firewall, Glyph Keypad, Access PIN, Server Reboot.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Fragments recovered so far:',
            'Access PIN gave D. Firewall gave N. Server Reboot gave E. Glyph Keypad gave O.',
          ],
        },
      },
      explanation: 'N, O, D, E in that order spells NODE.',
    },
  },
];

const pools = {
  /** Firewall: PRD asks for 8+ (SECURITY, FIREWALL, PASSWORD…). */
  caesarWords: ['SECURITY', 'FIREWALL', 'PASSWORD', 'ENCRYPT', 'NETWORK', 'BACKDOOR', 'MALWARE', 'PROTOCOL', 'SERVER', 'KERNEL'],
  /** Vault Finale: 4-letter words whose letters become the rewards of levels 1–4 (BYTE, CODE, ROOT, NODE…). */
  finaleWords: ['BYTE', 'CODE', 'ROOT', 'NODE', 'HACK', 'LINK', 'PORT', 'DISK'],
};

module.exports = { theme, templates, pools };
