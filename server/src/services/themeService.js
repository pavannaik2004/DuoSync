/** Themes and level templates in MongoDB (D50), plus the snapshot attempts keep (D51). */
const Theme = require('../models/Theme');
const LevelTemplate = require('../models/LevelTemplate');
const AppError = require('../utils/AppError');
const { getContent, listThemes, fallbackLevel } = require('../content');

const THEME_FIELDS = ['name', 'genre', 'story', 'timerMinutes', 'styleKey', 'boardLabel', 'roles', 'revealText', 'failText'];
const TEMPLATE_FIELDS = ['title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];

const pick = (source, keys) => Object.fromEntries(keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]));

/** D51: the theme data a challenge or attempt keeps, so later edits never change a game in progress. */
function themeSnapshot(theme) {
  return {
    slug: theme.slug,
    name: theme.name,
    genre: theme.genre,
    story: theme.story,
    roles: theme.roles,
    timerMinutes: theme.timerMinutes,
    styleKey: theme.styleKey,
    boardLabel: theme.boardLabel,
    revealText: theme.revealText,
    failText: theme.failText,
  };
}

/**
 * Inserts the content-module themes. Existing ones are left alone unless `overwrite`,
 * which also resets their templates and pools to the module values.
 */
async function seedThemes({ overwrite = false } = {}) {
  let created = 0;
  let updated = 0;
  for (const slug of listThemes()) {
    const { theme, templates, pools } = getContent(slug);
    const fields = { ...pick(theme, THEME_FIELDS), pools };
    let doc = await Theme.findOne({ slug });
    if (!doc) {
      doc = await Theme.create({ slug, ...fields });
      created += 1;
    } else if (overwrite) {
      doc.set({ ...fields, active: true, deletedAt: null });
      await doc.save();
      updated += 1;
    } else {
      continue;
    }
    for (const template of templates) {
      await LevelTemplate.findOneAndUpdate(
        { themeId: doc._id, order: template.order },
        { $set: { themeId: doc._id, ...pick(template, ['order', ...TEMPLATE_FIELDS]) } },
        { upsert: true, runValidators: true },
      );
    }
  }
  return { created, updated };
}

/** Seeds only an empty collection, so edits made later are not undone at boot. */
async function ensureSeeded() {
  if (await Theme.exists({})) return 0;
  return (await seedThemes({ overwrite: false })).created;
}

const activeFilter = { active: true, deletedAt: null };

async function listActiveThemes() {
  const themes = await Theme.find(activeFilter).sort({ createdAt: 1, _id: 1 }).lean();
  return themes.map((t) => pick(t, ['slug', 'name', 'genre', 'story', 'timerMinutes', 'styleKey', 'roles']));
}

/** The snapshot, templates, pools and fallback level set for a playable theme. */
async function loadThemeContent(slug) {
  const theme = await Theme.findOne({ slug, ...activeFilter }).lean();
  if (!theme) throw new AppError(404, 'THEME_NOT_FOUND', 'That theme does not exist');
  const templates = (await LevelTemplate.find({ themeId: theme._id }).sort({ order: 1 }).lean())
    .map((t) => pick(t, ['order', ...TEMPLATE_FIELDS]));
  return {
    theme: themeSnapshot(theme),
    templates,
    pools: theme.pools || {},
    fallbackLevels: templates.map(fallbackLevel),
  };
}

module.exports = { seedThemes, ensureSeeded, listActiveThemes, loadThemeContent, themeSnapshot };
