const { seedThemes } = require('../../src/services/themeService');

/** Inserts the 8 content themes. Call after startDb() and again after any clearDb(). No parameters, so Jest can use it as a hook. */
const seedTestThemes = () => seedThemes();

module.exports = { seedThemes: seedTestThemes };
