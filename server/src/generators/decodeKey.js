const { must } = require('./util');
const { buildLevel } = require('./pick');

/** Role B's tokens, each looked up in Role A's key, joined into the code. */
function solve(level) {
  const key = level.clueA.data.tokens;
  return level.clueB.data.tokens.map((t) => {
    const entry = key.find((k) => k.label === t.label);
    must(entry && entry.value !== undefined, `No key entry for ${t.label}`);
    return entry.value;
  }).join('');
}

/** Four distinct digits on four colour (or named) keys; Role B names the keys in a new order. */
function generate({ template, params, rng, context }) {
  const { copy } = params;
  const count = params.keys;
  const digits = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], count).map(String);
  let keys;
  if (Array.isArray(params.labels)) {
    const colors = rng.shuffle(params.colors);
    keys = rng.shuffle(params.labels).slice(0, count).map((label, i) => ({ label, color: colors[i] }));
  } else {
    keys = rng.sample(params.colors, count).map((color) => ({ label: color.toUpperCase(), color }));
  }
  const tokensA = keys.map((key, i) => ({ ...key, value: digits[i] }));
  let order = rng.shuffle(tokensA);
  for (let tries = 0; tries < 20 && order.every((t, i) => t === tokensA[i]); tries += 1) order = rng.shuffle(tokensA);
  const answer = order.map((t) => t.value).join('');
  return buildLevel({
    template,
    context,
    answerKind: 'code',
    answer,
    clueA: { type: 'tokens', data: { caption: copy.captionA, tokens: tokensA } },
    clueB: { type: 'tokens', data: { caption: copy.captionB, tokens: order.map(({ label, color }) => ({ label, color })) } },
    explanation: `${order.map((t) => `${t.label} ${t.value}`).join(', ')} gives ${answer}.`,
  });
}

module.exports = { solve, generate };
