/**
 * Admin levels inside a theme (ADMIN-3). Every write is checked on the would-be result when the theme is active
 * (D85), and returns the theme's ThemeDetail so the editor refreshes in one call. Orders stay 1..n (D87).
 */
const mongoose = require('mongoose');
const LevelTemplate = require('../models/LevelTemplate');
const AppError = require('../utils/AppError');
const { loadDraft, assertPlayable, detailOf, plain } = require('./adminThemeService');

const MAX_LEVELS = 5;
const EDITABLE = ['title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];

const editsOf = (fields) => Object.fromEntries(EDITABLE.filter((k) => fields[k] !== undefined).map((k) => [k, fields[k]]));
const badOrder = () => new AppError(400, 'VALIDATION_ERROR', 'List every level of this theme exactly once', [
  { field: 'levelIds', message: 'List every level of this theme exactly once' },
]);

async function findLevel(levelId) {
  const level = mongoose.isValidObjectId(levelId) ? await LevelTemplate.findById(levelId) : null;
  if (!level) throw new AppError(404, 'LEVEL_NOT_FOUND', 'That level does not exist');
  return level;
}

async function detail(themeId) {
  const { theme, templates } = await loadDraft(themeId);
  return detailOf(theme, templates);
}

/** Plain copies of `ordered` numbered 1..n, for checking a reorder or delete before it is written. */
const renumbered = (ordered) => ordered.map((t, i) => ({ ...plain(t), order: i + 1 }));

/**
 * Writes the orders 1..n for `ordered` in two phases (negative, then final), so the { themeId, order } unique index
 * never sees two levels on one order (D87).
 */
async function writeOrders(ordered) {
  if (ordered.length === 0) return;
  await LevelTemplate.bulkWrite(ordered.map((t, i) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { order: -(i + 1) } } } })));
  await LevelTemplate.bulkWrite(ordered.map((t, i) => ({ updateOne: { filter: { _id: t._id }, update: { $set: { order: i + 1 } } } })));
}

async function listLevels(themeId) {
  return (await detail(themeId)).levels;
}

async function createLevel(themeId, fields) {
  const { theme, templates } = await loadDraft(themeId, { writable: true });
  if (templates.length >= MAX_LEVELS) throw new AppError(409, 'THEME_FULL', 'A theme has at most 5 levels');
  const level = new LevelTemplate({ themeId: theme._id, order: templates.length + 1, ...editsOf(fields) });
  if (theme.active) assertPlayable(theme, [...templates, level]);
  await level.save();
  return detail(theme._id);
}

async function updateLevel(levelId, fields) {
  const found = await findLevel(levelId);
  const { theme, templates } = await loadDraft(found.themeId, { writable: true });
  const level = templates.find((t) => String(t._id) === String(found._id));
  level.set(editsOf(fields));
  level.markModified('params');
  level.markModified('fallback');
  if (theme.active) assertPlayable(theme, templates);
  await level.save();
  return detail(theme._id);
}

async function deleteLevel(levelId) {
  const found = await findLevel(levelId);
  const { theme, templates } = await loadDraft(found.themeId, { writable: true });
  const rest = templates.filter((t) => String(t._id) !== String(found._id));
  if (theme.active) assertPlayable(theme, renumbered(rest));
  await LevelTemplate.deleteOne({ _id: found._id });
  await writeOrders(rest);
  return detail(theme._id);
}

/** `levelIds` must be exactly the theme's level ids, each once, in the new order. */
async function reorderLevels(themeId, levelIds) {
  const { theme, templates } = await loadDraft(themeId, { writable: true });
  const byId = new Map(templates.map((t) => [String(t._id), t]));
  const unique = new Set(levelIds);
  if (levelIds.length !== templates.length || unique.size !== levelIds.length || !levelIds.every((id) => byId.has(id))) {
    throw badOrder();
  }
  const ordered = levelIds.map((id) => byId.get(id));
  if (theme.active) assertPlayable(theme, renumbered(ordered));
  await writeOrders(ordered);
  return detail(theme._id);
}

module.exports = { listLevels, createLevel, updateLevel, deleteLevel, reorderLevels };
