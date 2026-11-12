const mongoose = require('mongoose');

const { generatedLevelFields, progressLevelFields } = require('./levelFields');

const { ObjectId, Mixed } = mongoose.Schema.Types;
const STATUSES = ['entered', 'lobby', 'countdown', 'in_progress', 'paused', 'finished', 'timed_out', 'ended_early'];
const FINAL = ['finished', 'timed_out', 'ended_early'];
const upper = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v);

const playerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // token subject: a user id or guest_<uuid> (DECISIONS D32)
    kind: { type: String, enum: ['user', 'guest'], required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['A', 'B', null], default: null },
    ready: { type: Boolean, default: false },
  },
  { _id: false },
);

// A generated level plus this attempt's progress on it (PRD §9.1).
const levelSchema = new mongoose.Schema({ ...generatedLevelFields, ...progressLevelFields }, { _id: false });

const attemptSchema = new mongoose.Schema(
  {
    challengeId: { type: ObjectId, ref: 'Challenge', default: null }, // null for practice
    teamId: { type: ObjectId, ref: 'Team', default: null },
    memberIds: { type: [ObjectId], default: [] }, // challenge entries: the team members, for the one-team-per-player index (NFR-7)
    practiceCode: { type: String, set: upper }, // setter uppercases codes (§10.1 Unit III)
    themeSlug: { type: String, required: true },
    theme: { type: Mixed, default: null }, // snapshot of the theme at creation (D51)
    timerMinutes: { type: Number, default: 15 },
    players: {
      type: [playerSchema],
      validate: { validator: (list) => list.length <= 2, message: 'An attempt has at most 2 players' },
    },
    status: { type: String, enum: STATUSES, default: 'entered' },
    levels: { type: [levelSchema], default: [] },
    board: { type: [new mongoose.Schema({ order: Number, title: String, reward: String }, { _id: false })], default: [] },
    countdownEndsAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    pauseUsedMs: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    levelsCleared: { type: Number, default: 0 },
    timeUsedMs: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    stars: { type: Number, default: 0 },
    finishedAt: { type: Date, default: null },
  },
  // Every save checks __v, so a lobby save on a stale copy fails instead of writing
  // over a team change (D79); the lobby service retries it.
  { timestamps: true, optimisticConcurrency: true },
);

attemptSchema.index({ practiceCode: 1 }, { unique: true, partialFilterExpression: { practiceCode: { $type: 'string' } } });

// One attempt per team and one team per player in a challenge (D56, NFR-7).
const inChallenge = { partialFilterExpression: { challengeId: { $type: 'objectId' } } };
attemptSchema.index({ challengeId: 1, teamId: 1 }, { unique: true, ...inChallenge });
attemptSchema.index({ challengeId: 1, memberIds: 1 }, { unique: true, ...inChallenge });

const Attempt = mongoose.model('Attempt', attemptSchema);

module.exports = Attempt;
module.exports.FINAL = FINAL;
module.exports.STATUSES = STATUSES;
