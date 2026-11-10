const { must } = require('./util');

/** Role B's tokens, each looked up in Role A's key, joined into the code. */
function solve(level) {
  const key = level.clueA.data.tokens;
  return level.clueB.data.tokens.map((t) => {
    const entry = key.find((k) => k.label === t.label);
    must(entry && entry.value !== undefined, `No key entry for ${t.label}`);
    return entry.value;
  }).join('');
}

module.exports = { solve };
