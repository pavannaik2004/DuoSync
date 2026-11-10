/** Builds a whole 5-level set for one seed (PRD §6.1): plan the finale, generate each level with retries, else fall back. */
const { createRng } = require('./rng');
const { validateLevel } = require('./validate');
const { GENERATORS } = require('./index');
const { plan: finalePlan } = require('./fragmentFinale');

const RETRIES = 20;
const SHAPE = ['answerKind', 'answer', 'acceptedAnswers', 'reward', 'clueA', 'clueB', 'explanation'];

/** A level in the Attempt shape: the template's order, title and hint, then the generated fields. `solution` is dropped. */
function shape(template, generated) {
  const level = { order: template.order, title: template.title, hint: template.hint };
  for (const key of SHAPE) level[key] = generated[key];
  return level;
}

/** The fixed fallback set for these templates (D54), carrying no `solution`. */
const fallbackSet = (templates) => templates.map((template) => shape(template, template.fallback));

/**
 * generateLevelSet({ templates, pools }, seed) → { levels, seed, usedFallback }.
 * Levels are generated in order with `${seed}:${order}:${retry}` keys; the first that validates is kept. If any level
 * fails every retry, the whole fallback set is returned, because the rewards are planned across the set.
 */
function generateLevelSet(content, seed) {
  const { templates, pools } = content;
  const ordered = [...templates].sort((a, b) => a.order - b.order);
  const finale = ordered.find((t) => t.mechanic === 'fragment-finale');
  const slug = (content.theme && content.theme.slug) || 'unknown';
  const fail = (template) => {
    console.warn(`Level generation fell back to the fixed set: theme ${slug}, level ${template.order}, seed ${seed}`);
    return { levels: fallbackSet(ordered), seed, usedFallback: true };
  };
  let thePlan;
  try {
    thePlan = finalePlan({ templates: ordered, params: finale ? finale.params : {}, pools, rng: createRng(`${seed}:plan`) });
  } catch (err) {
    return fail(finale || ordered[0]);
  }
  const built = [];
  for (const template of ordered) {
    const generator = GENERATORS[template.mechanic];
    let level = null;
    for (let retry = 0; retry < RETRIES && !level; retry += 1) {
      const context = { levels: [...built], pools, params: template.params, plan: thePlan };
      try {
        const rng = createRng(`${seed}:${template.order}:${retry}`);
        const candidate = generator.generate({ template, params: template.params, pools, rng, context });
        const full = { order: template.order, title: template.title, hint: template.hint, ...candidate };
        if (validateLevel(full, { mechanic: template.mechanic, context }).length === 0) level = full;
      } catch (err) {
        // a generator may give up on a layout; the next retry uses a new rng
      }
    }
    if (!level) return fail(template);
    built.push(level);
  }
  return { levels: built.map((level, i) => shape(ordered[i], level)), seed, usedFallback: false };
}

module.exports = { generateLevelSet };
