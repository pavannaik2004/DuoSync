const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { signToken } = require('./tokenService');

const BCRYPT_COST = 10; // NFR-2
// Compared against when the email is unknown, so both failures take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', BCRYPT_COST);

const usernameTaken = () => new AppError(409, 'USERNAME_TAKEN', 'That username is taken');
const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with that email already exists');

function session(user) {
  return { token: signToken({ sub: user.id, kind: 'user' }), user: user.toJSON() };
}

async function signup({ username, email, password }) {
  const normalizedEmail = email.toLowerCase();
  const [byName, byEmail] = await Promise.all([
    User.findOne({ username }).collation(User.CASE_INSENSITIVE),
    User.findOne({ email: normalizedEmail }),
  ]);
  if (byName) throw usernameTaken();
  if (byEmail) throw emailTaken();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const user = await User.create({ username, email: normalizedEmail, passwordHash });
    return session(user);
  } catch (err) {
    // Two signups racing past the checks above.
    if (err.code === 11000) throw err.keyPattern && err.keyPattern.email ? emailTaken() : usernameTaken();
    throw err;
  }
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  return session(user);
}

/** Guests are not stored; the token carries the guest id and nickname (§9.1). */
function guest({ nickname }) {
  const id = `guest_${crypto.randomUUID()}`;
  return { token: signToken({ sub: id, kind: 'guest', nickname }), guest: { id, nickname } };
}

/** The signed-in identity behind req.auth. */
async function me(auth) {
  if (auth.kind === 'guest') return { kind: 'guest', guest: { id: auth.id, nickname: auth.nickname } };
  const user = mongoose.isValidObjectId(auth.id) ? await User.findById(auth.id) : null;
  if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again');
  return { kind: 'user', user: user.toJSON() };
}

module.exports = { signup, login, guest, me };
