/**
 * Input patterns (AUTH-1, TEAM-1). client/src/utils/validators.js holds the
 * same regexes for the forms — keep the two files identical.
 */
const patterns = {
  USERNAME: /^[A-Za-z0-9_]{3,20}$/,
  NICKNAME: /^[A-Za-z0-9_]{3,20}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/,
  TEAM_NAME: /^(?=.{3,24}$)[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/,
  // Practice room code: 6 characters from the code alphabet (DECISIONS D6), any case.
  PRACTICE_CODE: /^[A-HJ-NP-Z2-9]{6}$/i,
  CHALLENGE_NAME: /^(?=.{3,40}$)[A-Za-z0-9_'!?-]+(?: [A-Za-z0-9_'!?-]+)*$/,
  CHALLENGE_CODE: /^[A-HJ-NP-Z2-9]{6}$/i,
};

module.exports = patterns;
