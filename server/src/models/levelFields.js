const mongoose = require('mongoose');

const { Mixed } = mongoose.Schema.Types;

/** The generated part of a level (PRD §9.1). A challenge stores only these. */
const generatedLevelFields = {
  order: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: true },
  clueA: { type: Mixed, required: true },
  clueB: { type: Mixed, required: true },
  answer: { type: String, required: true },
  acceptedAnswers: { type: [String], default: [] },
  answerKind: { type: String, enum: ['word', 'code', 'list'], required: true },
  reward: { type: String, default: null },
  hint: { type: String, default: null },
  explanation: { type: String, default: null },
};

/** What an attempt adds while it is played. */
const progressLevelFields = {
  unlockedAt: { type: Date, default: null },
  hintRevealedAt: { type: Date, default: null },
  solvedAt: { type: Date, default: null },
  solvedBy: { type: String, default: null },
  activeMs: { type: Number, default: 0 },
  wrongCount: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
};

module.exports = { generatedLevelFields, progressLevelFields };
