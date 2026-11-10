/**
 * Theme content registry (docs/themed-puzzle-sets.md). Each theme module holds the theme, its 5 level
 * templates (each with fixed fallback values) and the pools its generators draw from. Until the Phase 3
 * level engine lands, a game plays the fallback values, exposed here as `levels`.
 */
const cyberHeist = require('./themes/cyberHeist');
const detective = require('./themes/detective');
const spaceStation = require('./themes/spaceStation');
const pirate = require('./themes/pirate');
const hauntedAsylum = require('./themes/hauntedAsylum');
const sunKingTomb = require('./themes/sunKingTomb');
const alchemistTower = require('./themes/alchemistTower');
const polarExpedition = require('./themes/polarExpedition');

const LEVEL_FIELDS = ['answerKind', 'answer', 'acceptedAnswers', 'reward', 'clueA', 'clueB', 'explanation'];

/** A template's fallback as a playable level (the Attempt level shape). */
function fallbackLevel(template) {
  const level = { order: template.order, title: template.title, hint: template.hint };
  for (const key of LEVEL_FIELDS) level[key] = template.fallback[key];
  return level;
}

const ALL = [cyberHeist, detective, spaceStation, pirate, hauntedAsylum, sunKingTomb, alchemistTower, polarExpedition]
  .map((mod) => Object.freeze({ ...mod, levels: mod.templates.map(fallbackLevel) }));
const BY_SLUG = Object.fromEntries(ALL.map((content) => [content.theme.slug, content]));

/** The theme, templates, pools and fallback level set for a slug. Throws for an unknown slug (a programming error). */
function getContent(slug) {
  const content = BY_SLUG[slug];
  if (!content) throw new Error(`Unknown theme: ${slug}`);
  return content;
}

/** Every theme slug, in catalogue order. */
function listThemes() {
  return ALL.map((content) => content.theme.slug);
}

/** Replaces `{answer.N}` with level N's answer, e.g. the Detective reveal names the killer. */
function fillText(text, levels) {
  return String(text).replace(/\{answer\.(\d)\}/g, (match, order) => {
    const level = (levels || []).find((l) => l.order === Number(order));
    return level ? level.answer : match;
  });
}

module.exports = { getContent, listThemes, fillText };
