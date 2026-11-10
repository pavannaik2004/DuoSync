const { textOf, must } = require('./util');
const { buildLevel, fill, leaks, attempt } = require('./pick');

/** True when the text holds `n` as a number of its own, so a delta of 5 is not found inside 15 or 1050. */
const showsNumber = (text, n) => new RegExp(String.raw`(?<!\d)${n}(?!\d)`).test(text);

/** reading + delta. Clue A must show the reading and clue B the size of the correction. 'clock' answers are 12-hour HHMM. */
function solve(level) {
  const s = level.solution;
  must(s && typeof s.reading === 'string' && Number.isInteger(s.delta), 'arithmetic needs a solution');
  must(textOf(level.clueA).includes(s.reading), 'Clue A does not show the reading');
  must(showsNumber(textOf(level.clueB), Math.abs(s.delta)), 'Clue B does not show the correction');
  if (s.format === 'number') return String(Number(s.reading) + s.delta);
  must(s.format === 'clock', `Unknown format ${s.format}`);
  const match = s.reading.match(/^(\d{1,2}):(\d{2})$/);
  must(match, 'Not a clock reading');
  const total = ((((Number(match[1]) % 12) * 60 + Number(match[2]) + s.delta) % 720) + 720) % 720;
  const hours = Math.floor(total / 60) || 12;
  return `${String(hours).padStart(2, '0')}${String(total % 60).padStart(2, '0')}`;
}

const pad2 = (n) => String(n).padStart(2, '0');
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
/** 'H:MM' on a 12-hour face, e.g. 1415 -> '2:15'. */
const face = (minutes) => `${Math.floor(minutes / 60) % 12 || 12}:${pad2(minutes % 60)}`;
/** Four digits on a 12-hour face, e.g. 1415 -> '0215'. */
const digits = (minutes) => `${pad2(Math.floor(minutes / 60) % 12 || 12)}${pad2(minutes % 60)}`;
const stepped = (rng, lo, hi, step) => lo + step * rng.int(0, Math.floor((hi - lo) / step));
const text = (...paragraphs) => ({ type: 'text', data: { paragraphs } });

/** Shared tail: the clue pair, a bounded check that the answer is not written in the fixed text, and the level. */
function finish({ template, context, copy, answerKind, answer, reading, delta, format, values, rewardValues, explanation, acceptedAnswers }) {
  const clueA = text(...[copy.introA, fill(copy.readingA, { reading })].filter(Boolean));
  const clueB = text(fill(copy.ruleB, values), copy.enterB);
  if (leaks(template, answer, answerKind, clueA, clueB)) return null;
  return buildLevel({
    template, context, answerKind, answer, acceptedAnswers, clueA, clueB, explanation, rewardValues,
    solution: { reading, delta, format },
  });
}

/** Detective 1: the murder time (23:05-23:35) plus the clock's error is what the stopped clock shows. */
function clockFast({ template, params, rng, context }) {
  const { copy } = params;
  return attempt('clock-fast', () => {
    const murder = stepped(rng, minutesOf(params.murderTime[0]), minutesOf(params.murderTime[1]), params.stepMinutes);
    const error = rng.pick(params.errorMinutes);
    const reading = face(murder + error);
    const answer = digits(murder);
    return finish({
      template, context, copy, answerKind: 'code', answer, reading, delta: -error, format: 'clock',
      values: { error },
      rewardValues: { time: `${face(murder)} ${murder >= 720 ? 'PM' : 'AM'}` },
      explanation: `The clock read ${reading} and runs ${error} minutes fast, so the murder was at ${face(murder)}.`,
    });
  });
}

/** Tomb 3: the dial (1:00-5:55) runs 15-35 minutes behind, so the true time is later than the shadow shows. */
function clockSlow({ template, params, rng, context }) {
  const { copy } = params;
  return attempt('clock-slow', () => {
    const shown = stepped(rng, minutesOf(params.readingRange[0]), minutesOf(params.readingRange[1]), params.stepMinutes);
    const error = rng.pick(params.errorMinutes);
    const reading = face(shown);
    const answer = digits(shown + error);
    return finish({
      template, context, copy, answerKind: 'code', answer, reading, delta: error, format: 'clock',
      values: { error },
      // A leading zero is optional: 0515 is also accepted as 515.
      acceptedAnswers: answer.startsWith('0') ? [answer.slice(1)] : [],
      explanation: `The dial shows ${reading} and runs ${error} minutes behind, so the true time is ${face(shown + error)} (${answer}).`,
    });
  });
}

/** Polar 4: the gauge reads too high by a correction, so the true amount is the reading minus it. */
function gaugeHigh({ template, params, rng, context }) {
  const { copy } = params;
  return attempt('gauge-high', () => {
    const shown = stepped(rng, params.readingRange[0], params.readingRange[1], params.step);
    const correction = stepped(rng, params.correction[0], params.correction[1], params.step);
    const answer = String(shown - correction);
    return finish({
      template, context, copy, answerKind: 'code', answer, reading: String(shown), delta: -correction, format: 'number',
      values: { correction },
      explanation: `The gauge reads ${shown} and is ${correction} too high, so there are ${answer} litres.`,
    });
  });
}

const VARIANTS = { 'clock-fast': clockFast, 'clock-slow': clockSlow, 'gauge-high': gaugeHigh };

/** Builds the level for `params.variant`; solve() re-derives the answer from the reading and the correction. */
function generate(args) {
  const build = VARIANTS[args.params.variant];
  must(build, `Unknown arithmetic variant ${args.params.variant}`);
  return build(args);
}

module.exports = { solve, generate };
