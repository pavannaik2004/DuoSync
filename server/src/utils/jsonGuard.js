/**
 * D89 / NFR-5: admin JSON fields (params, fallback, pools) are stored as Mongoose Mixed, so they are checked here:
 * a plain object at the top, nested at most `maxDepth` deep, only JSON values, and no key that starts with `$` or
 * contains `.` (MongoDB operator and path syntax).
 */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.getPrototypeOf(v) === Object.prototype;

function ok(value, depth, maxDepth) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth >= maxDepth) return false;
  if (Array.isArray(value)) return value.every((v) => ok(v, depth + 1, maxDepth));
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(([key, v]) => !key.startsWith('$') && !key.includes('.') && ok(v, depth + 1, maxDepth));
}

/** True for a plain JSON object that is safe to store as Mixed. */
function isPlainJson(value, maxDepth = 10) {
  return isPlainObject(value) && ok(value, 0, maxDepth);
}

/** Escapes a user string for use inside a RegExp (search boxes). */
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { isPlainJson, isPlainObject, escapeRegex };
