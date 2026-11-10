const mongoose = require('mongoose');
const { MECHANICS } = require('../content/catalog');

const { ObjectId, Mixed } = mongoose.Schema.Types;

const levelTemplateSchema = new mongoose.Schema(
  {
    themeId: { type: ObjectId, ref: 'Theme', required: true },
    order: { type: Number, required: true, validate: { validator: (n) => Number.isInteger(n) && n >= 1 && n <= 5, message: 'order must be 1-5' } },
    title: { type: String, required: true },
    mechanic: { type: String, required: true, enum: MECHANICS },
    params: { type: Mixed, default: {} },
    hint: { type: String, default: null },
    rewardRule: { type: String, default: null },
    timeEstimateSec: { type: Number, default: null },
    fallback: { type: Mixed, required: true }, // may hold `solution`: server-only, never sent to clients
  },
  { timestamps: true, minimize: false },
);

levelTemplateSchema.index({ themeId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('LevelTemplate', levelTemplateSchema);
