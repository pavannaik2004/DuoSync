/**
 * What the level editor offers (D83): each mechanic with built-in examples from the 8 content modules, plus the lists
 * its selects use. An example carries the pools its params name, so an admin can add them to a new theme.
 */
const {
  MECHANICS, CLUE_TYPES, STYLE_KEYS, REWARD_RULES, SYMBOL_SHAPES, TOKEN_COLORS,
} = require('../content/catalog');
const { getContent, listThemes } = require('../content');

/** The names of `pools` that appear as a string value anywhere in `params`. */
function poolNamesIn(params, pools) {
  const found = new Set();
  const walk = (value) => {
    if (typeof value === 'string') {
      if (Object.prototype.hasOwnProperty.call(pools, value)) found.add(value);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(params);
  return [...found];
}

function exampleOf(slug, template, pools) {
  return {
    theme: slug,
    order: template.order,
    title: template.title,
    mechanic: template.mechanic,
    params: template.params,
    fallback: template.fallback,
    hint: template.hint === undefined ? null : template.hint,
    rewardRule: template.rewardRule === undefined ? null : template.rewardRule,
    timeEstimateSec: template.timeEstimateSec === undefined ? null : template.timeEstimateSec,
    pools: Object.fromEntries(poolNamesIn(template.params, pools).map((name) => [name, pools[name]])),
  };
}

function catalog() {
  const examples = Object.fromEntries(MECHANICS.map((m) => [m, []]));
  for (const slug of listThemes()) {
    const { templates, pools } = getContent(slug);
    for (const template of templates) examples[template.mechanic].push(exampleOf(slug, template, pools));
  }
  return {
    mechanics: MECHANICS.map((slug) => ({ slug, examples: examples[slug] })),
    clueTypes: CLUE_TYPES,
    styleKeys: STYLE_KEYS,
    rewardRules: REWARD_RULES,
    symbolShapes: SYMBOL_SHAPES,
    tokenColors: TOKEN_COLORS,
  };
}

module.exports = { catalog, poolNamesIn };
