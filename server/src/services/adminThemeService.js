/**
 * Admin themes (ADMIN-2, 4, 7, 8). Payloads here may carry answers, fallbacks and pools: they are served only under
 * /api/admin (D88). An active theme must always pass checkTheme (D85).
 */
const mongoose = require('mongoose');
const Theme = require('../models/Theme');
const LevelTemplate = require('../models/LevelTemplate');
const AppError = require('../utils/AppError');
const { escapeRegex } = require('../utils/jsonGuard');
const { checkTheme } = require('./themeCheck');
const { draftContent } = require('./themeService');
const { generateLevelSet, newSeed } = require('../generators/levelSet');

const EDITABLE = ['name', 'genre', 'story', 'roles', 'timerMinutes', 'styleKey', 'boardLabel', 'revealText', 'failText', 'pools'];
const LEVEL_KEYS = ['order', 'title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);
const notFound = () => new AppError(404, 'THEME_NOT_FOUND', 'That theme does not exist');

/** The editable fields present in `fields`, with roles rebuilt so no stray keys are stored. */
function editsOf(fields) {
  const edits = {};
  for (const key of EDITABLE) if (fields[key] !== undefined) edits[key] = fields[key];
  if (fields.roles) {
    edits.roles = Object.fromEntries(['A', 'B'].map((r) => [r, {
      name: fields.roles[r].name,
      description: fields.roles[r].description || '',
    }]));
  }
  return edits;
}

async function findTheme(id, { writable = false } = {}) {
  const theme = mongoose.isValidObjectId(id) ? await Theme.findById(id) : null;
  if (!theme) throw notFound();
  if (writable && theme.deletedAt) {
    throw new AppError(409, 'THEME_DELETED', 'This theme was deleted. It can be viewed but not changed.');
  }
  return theme;
}

/** The theme document and its level documents, in order. */
async function loadDraft(id, options) {
  const theme = await findTheme(id, options);
  const templates = await LevelTemplate.find({ themeId: theme._id }).sort({ order: 1 });
  return { theme, templates };
}

const problemsOf = (themeLike, templates) => checkTheme(draftContent(plain(themeLike), templates.map(plain)));

/** D85: throws 422 THEME_INVALID listing every problem when `themeLike` with `templates` is not playable. */
function assertPlayable(themeLike, templates) {
  const problems = problemsOf(themeLike, templates);
  if (problems.length === 0) return;
  const details = problems.map((p) => ({ field: p.order ? `level ${p.order}` : 'theme', message: p.message }));
  throw new AppError(422, 'THEME_INVALID', "This theme can't be active yet", details);
}

function themeView(theme) {
  const t = plain(theme);
  return {
    id: String(t._id),
    slug: t.slug,
    ...Object.fromEntries(EDITABLE.map((k) => [k, t[k]])),
    active: t.active,
    deletedAt: t.deletedAt,
    updatedAt: t.updatedAt,
  };
}

function levelView(template) {
  const t = plain(template);
  return { id: String(t._id), ...Object.fromEntries(LEVEL_KEYS.map((k) => [k, t[k] === undefined ? null : t[k]])) };
}

/** ThemeDetail: the theme, its levels in order, and what stops it being playable. */
function detailOf(theme, templates) {
  const sorted = [...templates].sort((a, b) => a.order - b.order);
  return { theme: themeView(theme), levels: sorted.map(levelView), problems: problemsOf(theme, sorted) };
}

const STATUS_FILTERS = {
  active: { active: true, deletedAt: null },
  inactive: { active: false, deletedAt: null },
  deleted: { deletedAt: { $ne: null } },
  all: {},
};

async function listThemes({ q, status } = {}) {
  const filter = { ...(STATUS_FILTERS[status] || { deletedAt: null }) };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { slug: pattern }];
  }
  const themes = await Theme.find(filter).sort({ name: 1 }).lean();
  const counts = await LevelTemplate.aggregate([
    { $match: { themeId: { $in: themes.map((t) => t._id) } } },
    { $group: { _id: '$themeId', n: { $sum: 1 } } },
  ]);
  const countOf = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return themes.map((t) => ({
    id: String(t._id),
    slug: t.slug,
    name: t.name,
    genre: t.genre,
    active: t.active,
    deleted: Boolean(t.deletedAt),
    levelCount: countOf[String(t._id)] || 0,
    updatedAt: t.updatedAt,
  }));
}

async function getTheme(id) {
  const { theme, templates } = await loadDraft(id);
  return detailOf(theme, templates);
}

/** A new theme starts inactive with no levels. A slug is never reused, even a deleted theme's (D86). */
async function createTheme(fields) {
  try {
    const theme = await Theme.create({ slug: fields.slug, ...editsOf(fields), active: false });
    return detailOf(theme, []);
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'SLUG_TAKEN', 'That slug is already used (deleted themes keep theirs)');
    throw err;
  }
}

async function updateTheme(id, fields) {
  const { theme, templates } = await loadDraft(id, { writable: true });
  const edits = editsOf(fields);
  if (fields.active !== undefined) edits.active = fields.active;
  const next = { ...plain(theme), ...edits };
  if (next.active) assertPlayable(next, templates);
  theme.set(edits);
  theme.markModified('pools');
  theme.markModified('roles');
  await theme.save();
  return detailOf(theme, templates);
}

/** ADMIN-7: a soft delete. Challenges and attempts keep their own snapshots and levels (D51). */
async function deleteTheme(id, now) {
  const theme = await findTheme(id, { writable: true });
  theme.set({ deletedAt: new Date(now), active: false });
  await theme.save();
}

/** ADMIN-5 / D96: a sample level set, answers included, for any theme that isn't deleted. Nothing is saved. */
async function previewTheme(id, seed = newSeed()) {
  const { theme, templates } = await loadDraft(id, { writable: true });
  const content = draftContent(plain(theme), templates.map(plain));
  const set = generateLevelSet(content, seed, { quiet: true });
  const mechanicOf = Object.fromEntries(content.templates.map((t) => [t.order, t.mechanic]));
  return {
    seed: set.seed,
    usedFallback: set.usedFallback,
    failure: set.failure,
    levels: set.levels.map((level) => ({ ...level, mechanic: mechanicOf[level.order] })),
  };
}

module.exports = {
  previewTheme,
  listThemes, getTheme, createTheme, updateTheme, deleteTheme, loadDraft, assertPlayable, detailOf, findTheme, plain,
};
