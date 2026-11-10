/**
 * Upserts every theme (overwriting edits) and creates or promotes the admin (D50).
 * Usage: npm run seed   (needs MONGODB_URI; admin needs SEED_ADMIN_EMAIL/USERNAME/PASSWORD)
 */
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const User = require('../src/models/User');
const { seedThemes } = require('../src/services/themeService');

const BCRYPT_COST = 10; // same as authService (NFR-2)

async function seedAdmin({ SEED_ADMIN_EMAIL: email, SEED_ADMIN_USERNAME: username, SEED_ADMIN_PASSWORD: password }) {
  if (!email || !username || !password) {
    console.log('Skipping admin: set SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD to create one');
    return;
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    existing.roles = [...new Set([...existing.roles, 'player', 'admin'])];
    await existing.save();
    console.log(`Promoted ${existing.username} to admin`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await User.create({ username, email: email.toLowerCase(), passwordHash, roles: ['player', 'admin'] });
  console.log(`Created admin ${username}`);
}

async function main() {
  await connectDb(config.mongoUri);
  const { created, updated } = await seedThemes({ overwrite: true });
  console.log(`Themes: ${created} created, ${updated} updated`);
  await seedAdmin(process.env);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
