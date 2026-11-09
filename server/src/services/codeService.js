const crypto = require('crypto');

// No I, O, 0 or 1: codes are read aloud and typed by hand (DECISIONS D6).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random code: team invite = 8, challenge = 6, practice room = 6. */
function generateCode(length) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

module.exports = { generateCode, ALPHABET };
