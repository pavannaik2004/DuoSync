/**
 * Upserts every theme (overwriting edits) and creates or promotes the admin (D50).
 * Usage: npm run seed   (needs MONGODB_URI; admin needs SEED_ADMIN_EMAIL/USERNAME/PASSWORD)
 */
require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../src/config/env');
const { connectDb } = require('../src/config/db');
const { seedAdmin } = require('../src/services/userSeed');
const { seedThemes } = require('../src/services/themeService');

async function main() {
  await connectDb(config.mongoUri);
  const { created, updated } = await seedThemes({ overwrite: true });
  console.log(`Themes: ${created} created, ${updated} updated`);
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_USERNAME: username, SEED_ADMIN_PASSWORD: password } = process.env;
  const admin = await seedAdmin({ email, username, password });
  console.log(admin === 'skipped'
    ? 'Skipping admin: set SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD to create one'
    : `Admin ${username}: ${admin}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
