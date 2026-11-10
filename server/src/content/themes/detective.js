/**
 * Detective – Murder at Blackwood Manor (PRD §6.5; docs/themed-puzzle-sets.md §4.2).
 * Consistency rules: 4 suspects, exactly 1 cleared by the Alibi Check, the killer is one of the
 * other 3, the Dying Message is the killer's name shifted by the Footprint's shoe size.
 */
const theme = {
  slug: 'detective',
  name: 'Detective – Murder at Blackwood Manor',
  genre: 'Mystery',
  story:
    'Lord Blackwood lies dead in his study, and the storm has cut the manor off until dawn. The Inspector walks '
    + 'the scene: the clock, the prints, the body and the guests. The Pathologist holds the reference files that make '
    + 'the evidence speak. Name the killer in 20 minutes, before the guests can slip away.',
  timerMinutes: 20,
  styleKey: 'noir',
  boardLabel: 'Case notes',
  roles: {
    A: { name: 'Inspector', description: 'At the scene. You see the stopped clock, the alibis, the footprint, the wound and the last message.' },
    B: { name: 'Pathologist', description: 'In the lab with the files: clock records, the shoe-size chart, the weapons register and the cipher key.' },
  },
  // {answer.N} is replaced with level N's answer once the case is solved (the reveal names the killer and shoe size).
  revealText: 'It was {answer.5}, wearing size {answer.3} shoes. The case of Blackwood Manor is closed.',
  failText: 'Dawn breaks, the roads reopen, and the killer drives away. The case goes cold.',
};

const templates = [
  {
    order: 1,
    title: 'Stopped Clock',
    mechanic: 'arithmetic',
    timeEstimateSec: 120,
    params: { reading: 'clock', murderTime: ['23:05', '23:35'], stepMinutes: 5, errorMinutes: [10, 15, 20], errorDirection: 'fast' },
    hint: 'A fast clock shows a later time than the real one.',
    rewardRule: 'caseNote',
    fallback: {
      answerKind: 'code',
      answer: '1120',
      acceptedAnswers: [],
      reward: 'Murder at 11:20 PM',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'The study clock was knocked to the floor in the struggle and stopped.',
            'Its hands read 11:35.',
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            "From the clockmaker's service record: the study clock runs 15 minutes fast.",
            'Enter the true time of the murder as four digits, like 1050.',
          ],
        },
      },
      solution: {reading: '11:35', delta: -15, format: 'clock'},
      explanation: 'The clock read 11:35 and runs 15 minutes fast, so the murder was at 11:20.',
    },
  },
  {
    order: 2,
    title: 'Alibi Check',
    mechanic: 'rule-filter',
    timeEstimateSec: 180,
    params: { suspects: 4, cleared: 1, pool: 'suspects', builtAround: 'answer.1', witnessRequired: true },
    hint: 'A suspect is cleared only by a witness who saw them for the whole time of the murder.',
    rewardRule: 'caseNote',
    fallback: {
      answerKind: 'word',
      answer: 'BELLAMY',
      acceptedAnswers: [],
      reward: 'BELLAMY is cleared',
      clueA: {
        type: 'table',
        data: {
          caption: "The guests' statements",
          columns: ['Suspect', 'Seen with', 'From', 'Until'],
          rows: [
            ['ASHFORD', 'the vicar', '10:30 PM', '11:10 PM'],
            ['BELLAMY', 'the cook', '11:00 PM', '11:45 PM'],
            ['CROWE', 'nobody', '11:00 PM', '11:50 PM'],
            ['DUVAL', 'the butler', '11:25 PM', '12:00 AM'],
          ],
        },
      },
      clueB: {
        type: 'text',
        data: {
          paragraphs: [
            'A suspect is cleared only if a witness saw them for the whole time of the murder.',
            'The time of the murder is on your case board. Enter the name of the one cleared suspect.',
          ],
        },
      },
      solution: {table: 'A', where: [{col: 1, op: 'ne', value: 'nobody'}, {col: 2, op: 'covers', cols: [2, 3], value: '11:20 PM'}], pick: 0, sort: null, join: false},
      explanation: 'Only BELLAMY was seen by a witness (the cook) at 11:20 PM.',
    },
  },
  {
    order: 3,
    title: 'Footprint',
    mechanic: 'rule-filter',
    timeEstimateSec: 90,
    params: { printLengthCm: [22, 27], sizeChart: { 22: 5, 23: 6, 24: 7, 25: 8, 26: 9, 27: 10 }, belongsTo: 'killer' },
    hint: 'Find the row of the chart whose print length matches the print exactly.',
    rewardRule: 'caseNote',
    fallback: {
      answerKind: 'code',
      answer: '8',
      acceptedAnswers: [],
      reward: 'Shoe size 8',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'A muddy footprint leads from the study window to the body.',
            'Heel to toe, it measures 25 cm.',
          ],
        },
      },
      clueB: {
        type: 'table',
        data: {
          caption: 'Shoe-size chart. Enter the shoe size.',
          columns: ['Print length', 'Shoe size'],
          rows: [
            ['22 cm', '5'],
            ['23 cm', '6'],
            ['24 cm', '7'],
            ['25 cm', '8'],
            ['26 cm', '9'],
            ['27 cm', '10'],
          ],
        },
      },
      solution: {table: 'B', where: [{col: 0, op: 'eq', value: '25 cm'}], pick: 1, sort: null, join: false},
      explanation: 'A 25 cm print is a size 8 shoe.',
    },
  },
  {
    order: 4,
    title: 'Murder Weapon',
    mechanic: 'describe-match',
    timeEstimateSec: 120,
    params: { pool: 'weapons', shown: 5 },
    hint: 'Only one entry in the register leaves every mark the Inspector describes.',
    rewardRule: 'caseNote',
    fallback: {
      answerKind: 'word',
      answer: 'DAGGER',
      acceptedAnswers: ['KNIFE'],
      reward: 'Weapon: DAGGER',
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            'A single wound under the ribs: narrow, deep and clean-edged, with no bruising around it.',
          ],
        },
      },
      clueB: {
        type: 'table',
        data: {
          caption: 'Weapons register: the mark each one leaves.',
          columns: ['Weapon', 'Mark it leaves'],
          rows: [
            ['POKER', 'A round, blunt bruise with a scorch at its centre'],
            ['DAGGER', 'A narrow, deep puncture with clean edges and no bruising'],
            ['SCARF', 'A thin red line around the neck'],
            ['POISON', 'No wound at all; blue-tinged lips and nails'],
            ['HAMMER', 'A square-edged dent with heavy bruising'],
          ],
        },
      },
      explanation: 'A narrow, deep, clean wound with no bruising is the DAGGER.',
    },
  },
  {
    order: 5,
    title: 'Dying Message',
    mechanic: 'caesar',
    timeEstimateSec: 150,
    params: { carryOver: { shiftFrom: 3, killerFrom: 'uncleared suspects of level 2' }, direction: 'back' },
    hint: 'The shift is the shoe size from the Footprint, on your case board.',
    rewardRule: null,
    fallback: {
      answerKind: 'word',
      answer: 'CROWE',
      acceptedAnswers: [],
      reward: null,
      clueA: {
        type: 'text',
        data: {
          paragraphs: [
            "Scratched into the floorboards beside Lord Blackwood's hand:",
            'KZWEM',
          ],
        },
      },
      clueB: {
        type: 'strip',
        data: {
          caption: "Lord Blackwood's private cipher: every letter was moved forward by the killer's shoe size. Count back to read it.",
          numbered: true,
        },
      },
      explanation: 'KZWEM shifted back by 8 (the shoe size) is CROWE, one of the three suspects with no alibi.',
    },
  },
];

const pools = {
  /** Suspect names: 4 are drawn per game; one is cleared, the killer is one of the other 3. */
  suspects: ['ASHFORD', 'BELLAMY', 'CROWE', 'DUVAL', 'HARLOW', 'MORTON', 'SINCLAIR', 'VANCE', 'WHITLOCK', 'FENWICK'],
  /** Murder Weapon: the PRD's pool of 5. `wound` is the Inspector's half, `mark` the register entry. */
  weapons: [
    {
      name: 'POKER',
      wound: 'A round, blunt bruise on the temple, with a small burn at its centre.',
      mark: 'A round, blunt bruise with a scorch at its centre',
    },
    {
      name: 'DAGGER',
      wound: 'A single wound under the ribs: narrow, deep and clean-edged, with no bruising around it.',
      mark: 'A narrow, deep puncture with clean edges and no bruising',
    },
    {
      name: 'SCARF',
      wound: 'No cuts or bruises, only a fine red line running around the throat.',
      mark: 'A thin red line around the neck',
    },
    {
      name: 'POISON',
      wound: 'Not a mark on the body, but the lips and fingernails have turned faintly blue.',
      mark: 'No wound at all; blue-tinged lips and nails',
    },
    {
      name: 'HAMMER',
      wound: 'A dent in the skull with straight, square edges and dark bruising around it.',
      mark: 'A square-edged dent with heavy bruising',
    },
  ],
  /** Witnesses used when alibis are generated. */
  witnesses: ['the vicar', 'the cook', 'the butler', 'the maid', 'the gardener', 'the chauffeur'],
};

module.exports = { theme, templates, pools };
