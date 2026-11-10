const mongoose = require('mongoose');
const { generatedLevelFields } = require('./levelFields');

const { ObjectId, Mixed } = mongoose.Schema.Types;
const upper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

const levelSchema = new mongoose.Schema(generatedLevelFields, { _id: false });

/** A time window on one theme; its level set is generated once and shared by every team (CHAL-2). */
const challengeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, set: upper }, // setter uppercases codes (§10.1 Unit III)
    name: { type: String, required: true, trim: true },
    themeSlug: { type: String, required: true },
    theme: { type: Mixed, required: true }, // snapshot of the theme (D51)
    creatorId: { type: ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: ['public', 'private'], required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    maxTeams: { type: Number, min: 2, max: 500, default: null },
    seed: { type: String, required: true },
    levels: { type: [levelSchema], default: [] },
    usedFallback: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

challengeSchema.index({ visibility: 1, endsAt: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);
