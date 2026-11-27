/** Creates the admin, or promotes an existing account by email (D50). Admin is seed-only, never granted in the app (D90). */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { BCRYPT_COST } = require('./authService');

/** seedAdmin({ email, username, password }) → 'created' | 'promoted' | 'skipped' (when a value is missing). */
async function seedAdmin({ email, username, password } = {}) {
  if (!email || !username || !password) return 'skipped';
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.roles = [...new Set([...existing.roles, 'player', 'admin'])];
    await existing.save();
    return 'promoted';
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await User.create({ username, email: email.toLowerCase(), passwordHash, roles: ['player', 'admin'] });
  return 'created';
}

module.exports = { seedAdmin };
