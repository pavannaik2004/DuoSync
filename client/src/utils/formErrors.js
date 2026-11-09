// Server error codes that belong to one form field rather than the whole form.
const FIELD_CODES = {
  USERNAME_TAKEN: ['username', 'That username is taken. Try another.'],
  EMAIL_TAKEN: ['email', 'An account with this email already exists. Log in instead?'],
  TEAM_NAME_TAKEN: ['name', 'That team name is taken. Try another.'],
};

const FORM_MESSAGES = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  RATE_LIMITED: 'Too many attempts. Wait a minute, then try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
  INVALID_INVITE_CODE: 'That invite code does not work. It may be mistyped, or the captain made a new one.',
  TEAM_FULL: 'This team already has 2 players.',
  ALREADY_MEMBER: 'You are already in this team. Find it under My teams.',
  NOT_CAPTAIN: 'Only the team captain can do that.',
  TEAM_CHANGED: 'The team changed while you were doing that. Reload and try again.',
};

/** Splits an ApiError into { fields: { name: message }, form: message }. */
export function splitApiError(err) {
  if (err.code === 'VALIDATION_ERROR' && err.details?.length) {
    return { fields: Object.fromEntries(err.details.map((d) => [d.field, d.message])), form: '' };
  }
  if (FIELD_CODES[err.code]) {
    const [field, message] = FIELD_CODES[err.code];
    return { fields: { [field]: message }, form: '' };
  }
  return { fields: {}, form: FORM_MESSAGES[err.code] || err.message || 'Something went wrong. Try again.' };
}
