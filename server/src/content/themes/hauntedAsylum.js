/**
 * Haunted Asylum – The Ward 13 Séance (new theme, horror; docs/themed-puzzle-sets.md §4.5).
 * Uses only existing mechanics: Morse, Rule Filter, Split Riddle, Ordering, Fragment Finale.
 */
const { toMorse, morseChart } = require('../catalog');

const theme = {
  slug: 'haunted-asylum',
  name: 'Haunted Asylum – The Ward 13 Séance',
  genre: 'Horror',
  story:
    'Ravenhill Asylum closed a century ago, but the lights in Ward 13 still flicker every night. A restless spirit '
    + 'is trying to speak. The Medium sits in the ward and senses the signs. The Archivist is in the records room '
    + 'with the old files. Learn the spirit\'s name before the candles burn down in 20 minutes.',
  timerMinutes: 20,
  styleKey: 'haunted',
  boardLabel: 'Spirit letters',
  roles: {
    A: { name: 'Medium', description: 'In Ward 13. You sense the spirit: flickering lights, whispers, and the faces in the portraits.' },
    B: { name: 'Archivist', description: "In the records room with the patient files, the telegraph room's Morse chart and the portrait register." },
  },
  revealText: 'You speak the name {answer.5} aloud. The candles gutter, the air warms, and Ward 13 falls silent at last.',
  failText: 'The last candle goes out. Something in Ward 13 laughs softly in the dark.',
};

const templates = [
  {
    order: 1,
    title: 'Flickering Lights',
    mechanic: 'morse',
    timeEstimateSec: 150,
    params: { copy: { introA: 'The ward lights flicker short (.) and long (-), with a pause between letters:' }, pool: 'morseWords' },
    hint: 'A short flicker is a dot and a long one is a dash. Each group is one letter.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'word',
      answer: 'ATTIC',
      acceptedAnswers: [],
      reward: 'D',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The ward lights flicker short (.) and long (-), with a pause between letters:',
            toMorse('ATTIC'),
          ],
        },
      },
      clueB: { type: 'table', data: morseChart("Morse chart from the old telegraph room") },
      explanation: '.- - - .. -.-. is ATTIC: the spirit is pointing upstairs.',
    },
  },
  {
    order: 2,
    title: 'Patient Files',
    mechanic: 'rule-filter',
    timeEstimateSec: 180,
    params: { variant: 'patient-bed', copy: { clueA: ['A whisper from the dark:', '"I came here in the depth of winter. I never went home. I watched the world through the window by my bed."', 'Which bed was hers? Enter its number.'] }, items: 6, attributes: ['admitted', 'discharged', 'window'], conditions: 3, answerCount: 1, answer: 'bed number', listHolder: 'B' },
    hint: 'Check every part of the whisper against each file. Only one bed fits them all.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: '17',
      acceptedAnswers: [],
      reward: 'A',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'A whisper from the dark:',
            '"I came here in the depth of winter. I never went home. I watched the world through the window by my bed."',
            'Which bed was hers? Enter its number.',
          ],
        },
      },
      clueB: {
        type: 'table',
        data: {
          caption: 'Ward 13 admissions, 1923 (winter is December, January and February)',
          columns: ['Bed', 'Admitted', 'Discharged', 'By a window'],
          rows: [
            ['4', 'March', 'Yes', 'Yes'],
            ['9', 'January', 'No', 'No'],
            ['13', 'July', 'No', 'Yes'],
            ['17', 'December', 'No', 'Yes'],
            ['21', 'February', 'Yes', 'Yes'],
            ['26', 'October', 'No', 'Yes'],
          ],
        },
      },
      solution: {table: 'B', where: [{col: 1, op: 'in', value: ['December', 'January', 'February']}, {col: 2, op: 'eq', value: 'No'}, {col: 3, op: 'eq', value: 'Yes'}], pick: 0, sort: null, join: false},
      explanation: 'Only bed 17 was admitted in winter (December), never discharged, and by a window.',
    },
  },
  {
    order: 3,
    title: 'Whispers in the Walls',
    mechanic: 'split-riddle',
    timeEstimateSec: 120,
    params: { copy: { introA: 'The walls whisper the first half:', introB: "Written in a patient's diary:" }, pool: 'riddles' },
    hint: 'Put the two halves together and say them as one riddle.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'word',
      answer: 'ECHO',
      acceptedAnswers: [],
      reward: 'E',
      clueA: { type: 'text', data: { paragraphs: ['The walls whisper the first half:', 'Speak to me and I will answer,'] } },
      clueB: { type: 'text', data: { paragraphs: ['Written in a patient\'s diary:', 'yet no one is there when you turn around. What am I?'] } },
      explanation: 'Something that answers when you speak, with no one there: an ECHO.',
    },
  },
  {
    order: 4,
    title: 'Portrait Hall',
    mechanic: 'ordering',
    timeEstimateSec: 120,
    params: { directionWords: { desc: 'from the newest portrait to the oldest', asc: 'from the oldest portrait to the newest' }, copy: { captionA: 'The portraits whose eyes follow you, with the year painted on each frame', columns: ['Plaque', 'Year'], ruleLine: 'From the portrait register: "The ghosts walk the hall {direction}."' }, items: 4, valueRange: [1840, 1920], distinct: true, direction: ['desc', 'asc'], output: 'plaque numbers as one code' },
    hint: 'Sort the portraits by year first, then read off their plaque numbers.',
    rewardRule: 'letter',
    fallback: {
      answerKind: 'code',
      answer: '8635',
      acceptedAnswers: [],
      reward: 'N',
      clueA: {
        type: 'table',
        data: {
          caption: 'The portraits whose eyes follow you, with the year painted on each frame',
          columns: ['Plaque', 'Year'],
          rows: [['3', '1871'], ['8', '1902'], ['5', '1849'], ['6', '1888']],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'From the portrait register: "The ghosts walk the hall from the newest portrait to the oldest."',
            'Enter the plaque numbers in that order as one code.',
          ],
        },
      },
      solution: {table: 'A', idCol: 0, valueCol: 1, direction: 'desc'},
      explanation: 'Newest to oldest: 8 (1902), 6 (1888), 3 (1871), 5 (1849) gives 8635.',
    },
  },
  {
    order: 5,
    title: 'The Séance',
    mechanic: 'fragment-finale',
    timeEstimateSec: 90,
    params: { pool: 'finaleWords', rewards: 'letters', use: 'reward', copy: { introA: "The candles flare. Speak the spirit letters in the order she gave them:", introB: "Letters the spirit has given so far:", entry: "{title}: {value}." } },
    hint: 'The spirit letters are also on your board.',
    rewardRule: null,
    fallback: {
      answerKind: 'word',
      answer: 'EDNA',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The candles flare. Speak the spirit letters in the order she gave them:',
            'Whispers in the Walls, Flickering Lights, Portrait Hall, Patient Files.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'Letters the spirit has given so far:',
            'Flickering Lights: D. Patient Files: A. Whispers in the Walls: E. Portrait Hall: N.',
          ],
        },
      },
      explanation: 'E, D, N, A in that order spells the spirit\'s name: EDNA.',
    },
  },
];

const pools = {
  morseWords: ['GHOST', 'NURSE', 'ATTIC', 'CELLAR', 'LANTERN', 'SHADOW', 'WARDEN', 'CANDLE', 'MIRROR', 'CHAPEL', 'GRAVE', 'WHISPER', 'CRYPT', 'COFFIN', 'SPIRIT', 'DUNGEON', 'PHANTOM', 'SCREAM', 'CURSE', 'WIDOW'],
  riddles: [
    { partA: 'I follow you all day long,', partB: 'but vanish the moment the lights go out. What am I?', answer: 'SHADOW', acceptedAnswers: [] },
    { partA: 'Speak to me and I will answer,', partB: 'yet no one is there when you turn around. What am I?', answer: 'ECHO', acceptedAnswers: [] },
    { partA: 'The more of me there is,', partB: 'the less of the ward you can see. What am I?', answer: 'DARKNESS', acceptedAnswers: ['DARK'] },
    { partA: 'I have a face but no eyes, and hands but no arms;', partB: 'I strike, and everyone knows it is midnight. What am I?', answer: 'CLOCK', acceptedAnswers: [] },
    { partA: 'Say my name', partB: 'and I am broken, though nobody touched me. What am I?', answer: 'SILENCE', acceptedAnswers: [] },
    { partA: 'Every night I show you a face,', partB: 'but the face is never mine. What am I?', answer: 'MIRROR', acceptedAnswers: [] },
    { partA: 'I am tall when I am young and short when I am old;', partB: 'I glow in every dark corridor. What am I?', answer: 'CANDLE', acceptedAnswers: [] },
    { partA: 'I creak at night, though nobody walks on me;', partB: 'I lead up to the room nobody enters. What am I?', answer: 'STAIRS', acceptedAnswers: ['STAIR'] },
    { partA: "I walk the halls though I have no feet;", partB: "you cannot touch me, yet I make you shiver. What am I?", answer: 'GHOST', acceptedAnswers: [] },
    { partA: "I show you the world but keep you in,", partB: "a cold pane between you and the moon. What am I?", answer: 'WINDOW', acceptedAnswers: [] },
    { partA: "I am small and made of iron,", partB: "yet every locked door in the ward fears me. What am I?", answer: 'KEY', acceptedAnswers: [] },
    { partA: "I have a face with painted eyes,", partB: "I sit in the nursery, and still I watch you. What am I?", answer: 'DOLL', acceptedAnswers: [] },
    { partA: "I swing open without a hand to move me,", partB: "and I bar the way to what lies behind. What am I?", answer: 'DOOR', acceptedAnswers: [] },
    { partA: "I creep in over the ground without a sound,", partB: "and I hide the whole asylum from the road. What am I?", answer: 'FOG', acceptedAnswers: [] },
    { partA: "I ring but have no voice,", partB: "and when I toll at midnight the patients wake. What am I?", answer: 'BELL', acceptedAnswers: [] },
    { partA: "I glow but I have no flame,", partB: "and I watch the courtyard from the sky each night. What am I?", answer: 'MOON', acceptedAnswers: [] },
    { partA: "I am soft and I hold your head,", partB: "yet the patient who last used me never woke. What am I?", answer: 'PILLOW', acceptedAnswers: [] },
    { partA: "You see me only when your eyes are closed,", partB: "and some of me never lets you go. What am I?", answer: 'DREAM', acceptedAnswers: [] },
    { partA: "I hang on the wall and my eyes follow you,", partB: "though the one I show died long ago. What am I?", answer: 'PORTRAIT', acceptedAnswers: [] },
    { partA: "I tap on the glass but never come in,", partB: "and I fall from the sky to drum on the roof. What am I?", answer: 'RAIN', acceptedAnswers: [] },
  ],
  /** The Séance: the spirit's name (4 letters). */
  finaleWords: ['EDNA', 'CORA', 'ROSE', 'ELSA', 'MAUD', 'NELL', 'IRIS', 'LILA'],
};

module.exports = { theme, templates, pools };
