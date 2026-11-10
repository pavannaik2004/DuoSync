const { textOf, must } = require('./util');

/** Symbols: each of clue A's shapes through clue B's legend. Weapon variant: the pool weapon whose wound is clue A's text. */
function solve(level, context = {}) {
  if (level.clueA.type === 'symbols') {
    must(level.clueB.type === 'symbols', 'The legend must be a symbols clue');
    const legend = {};
    for (const s of level.clueB.data.symbols) {
      must(!(s.shape in legend), `Duplicate legend shape ${s.shape}`);
      legend[s.shape] = s.label;
    }
    const decoys = level.clueB.data.symbols.filter((s) => !level.clueA.data.symbols.some((a) => a.shape === s.shape));
    must(decoys.length >= 1, 'The legend needs at least one decoy');
    return level.clueA.data.symbols.map((s) => {
      must(legend[s.shape] !== undefined, `No legend entry for ${s.shape}`);
      return legend[s.shape];
    }).join('');
  }
  const weapons = (context.pools && context.pools.weapons) || [];
  const weapon = weapons.find((w) => w.wound === textOf(level.clueA));
  must(weapon, "Clue A is not a pool weapon's wound");
  return weapon.name;
}

module.exports = { solve };
