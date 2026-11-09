/**
 * Answer rules (PRD §6.4). Words and codes: uppercase, keep only letters and digits,
 * so "11:25" and "1125" match. Lists: separators collapse into one dash, so
 * "3, 7, 9" and "3 7 9" both become "3-7-9", but "379" does not.
 */
function normalizeAnswer(text, kind) {
  const upper = String(text).toUpperCase();
  if (kind === 'list') return upper.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return upper.replace(/[^A-Z0-9]/g, '');
}

/** True when `text` matches the level's answer or one of its accepted alternatives. */
function isCorrect(level, text) {
  const given = normalizeAnswer(text, level.answerKind);
  if (!given) return false;
  return [level.answer, ...(level.acceptedAnswers || [])]
    .some((candidate) => normalizeAnswer(candidate, level.answerKind) === given);
}

module.exports = { normalizeAnswer, isCorrect };
