/**
 * Seeded randomness for the level generators. Every generator draws only from the rng it is given,
 * so the same key (`${seed}:${order}:${retry}`) always rebuilds the same level.
 */

/** 32-bit FNV-1a hash of a string. */
function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast 32-bit generator. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** createRng(key) → { float, int(min, max) inclusive, pick(list), shuffle(list), sample(list, n) }. */
function createRng(key) {
  const next = mulberry32(fnv1a(String(key)));
  const float = () => next();
  const int = (min, max) => min + Math.floor(float() * (max - min + 1));
  const pick = (list) => list[int(0, list.length - 1)];
  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const sample = (list, n) => {
    if (n > list.length) throw new Error(`Cannot sample ${n} from ${list.length}`);
    return shuffle(list).slice(0, n);
  };
  return { float, int, pick, shuffle, sample };
}

module.exports = { createRng };
