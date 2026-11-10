/*
 * Form checks (AUTH-1, TEAM-1, Lab 5). The regexes are identical to
 * server/src/utils/patterns.js — keep the two files in step.
 * Each validator returns an error message, or '' when the value is fine.
 */
export const patterns = {
  USERNAME: /^[A-Za-z0-9_]{3,20}$/,
  NICKNAME: /^[A-Za-z0-9_]{3,20}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/,
  TEAM_NAME: /^(?=.{3,24}$)[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/,
  INVITE_CODE: /^[A-Za-z0-9]{1,16}$/,
  PRACTICE_CODE: /^[A-HJ-NP-Z2-9]{6}$/i,
  CHALLENGE_NAME: /^(?=.{3,40}$)[A-Za-z0-9_'!?-]+(?: [A-Za-z0-9_'!?-]+)*$/,
  CHALLENGE_CODE: /^[A-HJ-NP-Z2-9]{6}$/i,
};

const check = (pattern, empty, wrong) => (value) => {
  const v = (value ?? '').trim();
  if (!v) return empty;
  return pattern.test(v) ? '' : wrong;
};

export const validators = {
  username: check(patterns.USERNAME, 'Choose a username.', 'Use 3-20 letters, digits or underscores.'),
  nickname: check(patterns.NICKNAME, 'Choose a nickname.', 'Use 3-20 letters, digits or underscores.'),
  email: check(patterns.EMAIL, 'Enter your email address.', 'Enter a valid email address, like name@example.com.'),
  password: (value) => {
    if (!value) return 'Enter a password.';
    return patterns.PASSWORD.test(value) ? '' : 'Use at least 8 characters, with a letter and a digit.';
  },
  loginPassword: (value) => (value ? '' : 'Enter your password.'),
  teamName: (value) => {
    if (!(value ?? '').trim()) return 'Choose a team name.';
    return patterns.TEAM_NAME.test(value)
      ? ''
      : 'Use 3-24 letters, digits, single spaces, _ or -, with no space at the start or end.';
  },
  inviteCode: check(patterns.INVITE_CODE, 'Enter the invite code.', 'Invite codes contain only letters and digits.'),
  practiceCode: check(patterns.PRACTICE_CODE, 'Enter the room code.', 'Room codes have 6 letters and digits, like K7QM2X.'),
  challengeName: check(
    patterns.CHALLENGE_NAME,
    'Choose a challenge name.',
    "Use 3-40 letters, digits, single spaces, _ ' ! ? or -, with no space at the start or end.",
  ),
  challengeCode: check(patterns.CHALLENGE_CODE, 'Enter the challenge code.', 'Challenge codes have 6 letters and digits, like K7QM2X.'),
};
