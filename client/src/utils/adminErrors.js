/* Admin error copy (switch on the code, never on the message: D5). */
const MESSAGES = {
  THEME_INVALID: "This theme can't be active yet:",
  THEME_FULL: 'A theme has at most 5 levels.',
  SLUG_TAKEN: 'That slug is already used (deleted themes keep theirs).',
  THEME_DELETED: 'This theme was deleted. It can be viewed but not changed.',
  FORBIDDEN: 'Admins only.',
  THEME_NOT_FOUND: 'That theme does not exist.',
  LEVEL_NOT_FOUND: 'That level does not exist.',
  USER_NOT_FOUND: 'That user does not exist.',
};

const label = (field) => (field === 'theme' ? 'Theme' : String(field).replace(/^level /, 'Level '));

/** { message, items } for an ApiError: items lists THEME_INVALID or validation details as "Level 2: …" lines. */
export function adminError(err) {
  if (!err) return null;
  const details = err.details || [];
  if (err.code === 'THEME_INVALID') return { message: MESSAGES.THEME_INVALID, items: details.map((d) => `${label(d.field)}: ${d.message}`) };
  if (err.code === 'VALIDATION_ERROR') return { message: 'Check these fields:', items: details.map((d) => `${d.field}: ${d.message}`) };
  return { message: MESSAGES[err.code] || err.message || 'Something went wrong. Try again.', items: [] };
}

export const adminMessage = (code) => MESSAGES[code];
