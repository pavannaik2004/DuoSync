const mongoose = require('mongoose');

const { Mixed } = mongoose.Schema.Types;

// Seeded from src/content/themes/*.js (D50). Admin edits later survive restarts.
const themeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    genre: { type: String, default: '' },
    story: { type: String, default: '' },
    timerMinutes: { type: Number, required: true },
    styleKey: { type: String, default: '' },
    boardLabel: { type: String, default: '' },
    roles: { type: Mixed, required: true },
    revealText: { type: String, default: '' },
    failText: { type: String, default: '' },
    pools: { type: Mixed, default: {} },
    active: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

module.exports = mongoose.model('Theme', themeSchema);
