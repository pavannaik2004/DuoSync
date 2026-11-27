/**
 * ADMIN-4 / D84: is a theme playable? Pure — no database. Used for activation, for every write to an active theme
 * (D85) and for the problem list in the admin editor. An empty result means playable.
 */
const { STYLE_KEYS } = require('../content/catalog');
const { fallbackLevel } = require('../content');
const { validateLevel } = require('../generators/validate');
const { generateLevelSet } = require('../generators/levelSet');

const CHECK_SEEDS = 10;
const LEVELS = 5;

const roleName = (roles, key) => roles && roles[key] && typeof roles[key].name === 'string' && roles[key].name.trim();

function themeProblems(theme = {}) {
  const problems = [];
  const add = (message) => problems.push({ order: null, message });
  if (!roleName(theme.roles, 'A') || !roleName(theme.roles, 'B')) add('Both roles need a name');
  if (!Number.isInteger(theme.timerMinutes) || theme.timerMinutes < 5 || theme.timerMinutes > 60) add('Timer must be 5 to 60 minutes');
  if (!STYLE_KEYS.includes(theme.styleKey)) add('Choose a visual style from the list');
  return problems;
}

/** Each fixed level must pass the production validator, with earlier fixed levels as its context. */
function fallbackProblems(templates, pools) {
  const problems = [];
  const earlier = [];
  for (const template of templates) {
    let errors;
    try {
      const level = { ...fallbackLevel(template), solution: template.fallback.solution };
      const context = { levels: [...earlier], pools, params: template.params, plan: null };
      errors = validateLevel(level, { mechanic: template.mechanic, context });
      earlier.push(level);
    } catch (err) {
      errors = [err.message];
    }
    errors.forEach((e) => problems.push({ order: template.order, message: `Fixed values: ${e}` }));
  }
  return problems;
}

/** checkTheme({ theme, templates, pools }, { seeds }) → [{ order: number | null, message }]. */
function checkTheme(content, { seeds = CHECK_SEEDS } = {}) {
  const templates = [...(content.templates || [])].sort((a, b) => a.order - b.order);
  const problems = themeProblems(content.theme);
  if (templates.length !== LEVELS) {
    return [{ order: null, message: `A theme needs exactly ${LEVELS} levels (it has ${templates.length})` }, ...problems];
  }
  if (templates.some((t, i) => t.order !== i + 1)) return [{ order: null, message: 'Levels must be numbered 1 to 5' }, ...problems];
  const pools = content.pools || {};
  problems.push(...fallbackProblems(templates, pools));
  for (let i = 0; i < seeds; i += 1) {
    const set = generateLevelSet({ ...content, templates, pools }, `check-${i}`, { quiet: true });
    if (set.usedFallback) {
      problems.push({ order: set.failure.order, message: `Generation: ${set.failure.reason}` });
      break;
    }
  }
  return problems;
}

module.exports = { checkTheme, CHECK_SEEDS };
