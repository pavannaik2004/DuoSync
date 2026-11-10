/** Helpers shared by the generators: pool picks that honour the finale plan, rewards, and text filling. */

const textOfEntry = (entry) => (typeof entry === 'string' ? entry : entry.answer);

const squash = (text) => String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Picks an entry from a pool list (strings, or objects with an `answer`). When the finale plan fixed a first
 * letter for this level (`context.plan.startsWith[order]`, the Pirate password), only matching entries qualify.
 * `avoid` is the level's fixed text (captions, intros): entries whose answer appears in it are skipped,
 * because a half that spells the answer would be rejected (D49).
 */
function pickAnswer(list, rng, context, order, avoid = '') {
  const letter = context && context.plan && context.plan.startsWith && context.plan.startsWith[order];
  const fixed = squash(avoid);
  const candidates = list.filter((entry) => {
    const text = squash(textOfEntry(entry));
    return (!letter || text.startsWith(squash(letter))) && !(text.length >= 3 && fixed.includes(text));
  });
  if (candidates.length === 0) throw new Error(`No pool entry fits level ${order}${letter ? ` (starting with ${letter})` : ''}`);
  return rng.pick(candidates);
}

/** The fixed text of a template's clues: its copy, the fallback captions and the Morse chart headings. */
function fixedText(template) {
  const { clueA, clueB } = template.fallback;
  return [JSON.stringify(template.params.copy || {}), clueA.data.caption, clueB.data.caption, 'Letter Signal'].join(' ');
}

/** True when `clue`'s data spells `answer` (after squashing punctuation and case). */
const spells = (clue, answer) => squash(JSON.stringify(clue.data)).includes(squash(answer));
/** Replaces `{name}` placeholders with the given values; unknown placeholders stay as written. */
function fill(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

/** What a solved level adds to the board: the planned letter or digit, the answer, a filled case note, or nothing. */
function rewardFor(template, answer, context) {
  const rule = template.rewardRule;
  if (rule === 'letter' || rule === 'digit') {
    const reward = context && context.plan && context.plan.rewards && context.plan.rewards[template.order];
    return reward === undefined ? null : reward;
  }
  if (rule === 'answer') return answer;
  if (rule === 'caseNote') return fill(template.params.copy.reward, { answer });
  return null;
}

/** The caption the fallback clue of the same half carries (D55): used when `params.copy` has no caption for it. */
const fallbackCaption = (template, half) => template.fallback[half === 'A' ? 'clueA' : 'clueB'].data.caption;

/** Assembles a GeneratedLevel; `solution` is left out when there is none. */
function buildLevel({ template, context, answerKind, answer, acceptedAnswers = [], clueA, clueB, explanation, solution }) {
  const level = {
    clueA, clueB, answer, acceptedAnswers, answerKind, reward: rewardFor(template, answer, context), explanation,
  };
  if (solution) level.solution = solution;
  return level;
}

/** `count` distinct integers in lo..hi, in random order. */
function distinctInts(rng, lo, hi, count) {
  const seen = new Set();
  while (seen.size < count) seen.add(rng.int(lo, hi));
  return [...seen];
}

module.exports = { pickAnswer, fixedText, spells, fill, rewardFor, fallbackCaption, buildLevel, distinctInts };
