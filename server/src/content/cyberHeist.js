/**
 * Cyber Heist with fixed values (PRD §11 Phase 2; DECISIONS D33). In Phase 3 these
 * become the Cyber Heist templates' fallback values. Answers never leave the server.
 */
const theme = {
  slug: 'cyber-heist',
  name: 'Cyber Heist – Operation Blackout',
  story:
    'A rival firm has locked its vault behind five layers of security. The Hacker is inside the network '
    + 'and sees the raw signals. The Decoder holds the manuals that make sense of them. '
    + 'You have 15 minutes before the system resets.',
  timerMinutes: 15,
  roles: {
    A: { name: 'Hacker', description: 'Inside the network. You see the raw signals: keypads, codes and readouts.' },
    B: { name: 'Decoder', description: 'You hold the manuals: the rules and keys that make sense of the signals.' },
  },
  revealText: 'The vault door swings open. Operation Blackout is a success.',
  failText: 'The system reset before you got in. The vault stays locked.',
};

const levels = [
  {
    order: 1,
    title: 'Access PIN',
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
    hint: "Read each colour in the Decoder's order and take its digit from the Hacker's keypad.",
    explanation: 'GREEN 9, RED 7, YELLOW 4, BLUE 2 gives 9742.',
  },
  {
    order: 2,
    title: 'Firewall',
    answerKind: 'word',
    answer: 'FIREWALL',
    acceptedAnswers: [],
    reward: 'N',
    clueA: { type: 'text', data: { paragraphs: ['Intercepted password from the security gateway:', 'ILUHZDOO'] } },
    clueB: { type: 'strip', data: { caption: 'Shift every letter back by 3 places.', shift: 3, direction: 'back' } },
    hint: 'I moves back 3 places to F.',
    explanation: 'ILUHZDOO shifted back by 3 is FIREWALL.',
  },
  {
    order: 3,
    title: 'Server Reboot',
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
    hint: 'Three servers are offline.',
    explanation: 'Servers 4, 12 and 23 are offline: 23-12-4.',
  },
  {
    order: 4,
    title: 'Glyph Keypad',
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
    hint: 'Two glyphs in the legend are not on the panel.',
    explanation: 'Triangle 8, circle 3, star 1, square 5 gives 8315.',
  },
  {
    order: 5,
    title: 'Vault Finale',
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
    hint: 'The fragments are also on your team board.',
    explanation: 'N, O, D, E in that order spells NODE.',
  },
];

module.exports = { theme, levels };
