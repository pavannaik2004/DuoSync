/**
 * Production level validator (PRD §6.1): answer limits, clue shape, no half showing the answer (D49),
 * and a single answer that the mechanic's `solve` reproduces from the clue data.
 */
const { CLUE_TYPES, SYMBOL_SHAPES, TOKEN_COLORS } = require('../content/catalog');
const { normalizeAnswer } = require('../services/answers');
const { GENERATORS } = require('./index');

const isStr = (x) => typeof x === 'string';

/** Shape errors for one clue half, as strings. */
function validateClue(clue) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  if (!clue || !CLUE_TYPES.includes(clue.type)) return [`unknown clue type ${clue && clue.type}`];
  const { type, data } = clue;
  if (!data || typeof data !== 'object') return [`${type}: missing data`];
  check(data.caption === undefined || isStr(data.caption), `${type}: caption must be a string`);
  switch (type) {
    case 'text':
      check(Array.isArray(data.paragraphs) && data.paragraphs.length > 0 && data.paragraphs.every(isStr), 'text: paragraphs must be a non-empty list of strings');
      break;
    case 'tokens':
      check(Array.isArray(data.tokens) && data.tokens.length > 0, 'tokens: needs at least one token');
      (data.tokens || []).forEach((t) => {
        check(isStr(t.label), 'tokens: label must be a string');
        check(TOKEN_COLORS.includes(t.color), `tokens: unknown colour ${t.color}`);
        check(t.value === undefined || isStr(t.value), 'tokens: value must be a string');
      });
      break;
    case 'symbols':
      check(Array.isArray(data.symbols), 'symbols: needs a list');
      (data.symbols || []).forEach((s) => {
        check(SYMBOL_SHAPES.includes(s.shape), `symbols: unknown shape ${s.shape}`);
        check(s.label === undefined || isStr(s.label), 'symbols: label must be a string');
      });
      break;
    case 'table':
      check(Array.isArray(data.columns) && data.columns.every(isStr), 'table: columns must be strings');
      check(Array.isArray(data.rows), 'table: needs rows');
      (data.rows || []).forEach((row) => {
        check(Array.isArray(row) && row.length === (data.columns || []).length, 'table: a row has the wrong number of cells');
        check(Array.isArray(row) && row.every(isStr), 'table: cells must be strings');
      });
      break;
    case 'grid': {
      for (const n of [data.rows, data.cols]) check(Number.isInteger(n) && n >= 2 && n <= 8, 'grid: rows and cols must be 2-8');
      check(!data.colLabels || data.colLabels.length === data.cols, 'grid: colLabels length differs from cols');
      check(!data.rowLabels || data.rowLabels.length === data.rows, 'grid: rowLabels length differs from rows');
      const seen = new Set();
      (data.cells || []).forEach((cell) => {
        check(cell.r >= 0 && cell.r < data.rows && cell.c >= 0 && cell.c < data.cols, 'grid: a cell is off the grid');
        check(!seen.has(`${cell.r},${cell.c}`), 'grid: two cells share a position');
        seen.add(`${cell.r},${cell.c}`);
      });
      break;
    }
    case 'strip':
      if (data.numbered) check(data.shift === undefined, 'strip: a numbered strip has no shift');
      else {
        check(Number.isInteger(data.shift) && data.shift >= 1 && data.shift <= 25, 'strip: shift must be 1-25');
        check(['back', 'forward'].includes(data.direction), 'strip: direction must be back or forward');
      }
      break;
    default:
  }
  return errors;
}

/** D49: a half may name the answer only as one candidate among at least 3 rows of a table or labelled cells of a grid. */
function revealsAnswer(half, candidate, kind) {
  const target = normalizeAnswer(candidate, kind);
  if (target.length < 3 || !normalizeAnswer(JSON.stringify(half.data), kind).includes(target)) return false;
  const isTarget = (s) => normalizeAnswer(s, kind) === target;
  if (half.type === 'table') return !(half.data.rows.length >= 3 && half.data.rows.some((row) => row.some(isTarget)));
  if (half.type === 'grid') {
    const labelled = half.data.cells.filter((c) => c.label);
    return !(labelled.length >= 3 && labelled.some((c) => isTarget(c.label)));
  }
  return true;
}

function answerErrors(level) {
  const errors = [];
  const kind = level.answerKind;
  const answer = normalizeAnswer(level.answer, kind);
  if (answer !== level.answer) errors.push('answer is not normalized');
  if (kind === 'word') { if (!/^[A-Z]{1,8}$/.test(answer)) errors.push('a word answer is 1-8 letters'); }
  else if (kind === 'code') { if (!/^(?=.*\d)[A-Z0-9]{1,4}$/.test(answer)) errors.push('a code is up to 4 characters with at least one digit'); }
  else if (kind === 'list') {
    if (!/^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(answer)) errors.push('a list needs 2 or more dash-separated items');
    if (answer.length > 8) errors.push('a list answer is at most 8 characters');
  } else errors.push(`unknown answer kind ${kind}`);
  for (const alt of level.acceptedAnswers || []) {
    const n = normalizeAnswer(alt, kind);
    if (n.length < 1 || n.length > 8) errors.push(`accepted answer "${alt}" must be 1-8 characters`);
  }
  return errors;
}

/** All problems with a level, or [] when it is playable. `mechanic` is a catalog slug. */
function validateLevel(level, { mechanic, context }) {
  const errors = answerErrors(level);
  const generator = GENERATORS[mechanic];
  if (!generator) return [...errors, `unknown mechanic ${mechanic}`];
  for (const [name, half] of [['clue A', level.clueA], ['clue B', level.clueB]]) {
    validateClue(half).forEach((e) => errors.push(`${name}: ${e}`));
    if (half && CLUE_TYPES.includes(half.type) && half.data) {
      for (const candidate of [level.answer, ...(level.acceptedAnswers || [])]) {
        if (revealsAnswer(half, candidate, level.answerKind)) errors.push(`${name} shows the answer "${candidate}"`);
      }
    }
  }
  try {
    const solved = generator.solve(level, context);
    if (typeof solved !== 'string' && typeof solved !== 'number') errors.push('solve returned no answer');
    else if (normalizeAnswer(solved, level.answerKind) !== level.answer) errors.push(`solve gave "${solved}", not "${level.answer}"`);
  } catch (err) {
    errors.push(`solve failed: ${err.message}`);
  }
  return errors;
}

module.exports = { validateClue, revealsAnswer, validateLevel };
