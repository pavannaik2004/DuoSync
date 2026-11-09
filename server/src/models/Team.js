const mongoose = require('mongoose');
const patterns = require('../utils/patterns');

const { ObjectId } = mongoose.Schema.Types;
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, match: patterns.TEAM_NAME },
    captainId: { type: ObjectId, ref: 'User', required: true },
    memberIds: {
      type: [{ type: ObjectId, ref: 'User' }],
      validate: {
        // 0 members only once archived (TEAM-5); teamService enforces that.
        validator: (ids) => ids.length <= 2,
        message: 'A team has at most 2 members',
      },
    },
    // Setter uppercases codes (§10.1 Unit III). Removed when the team is archived.
    inviteCode: { type: String, set: (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v) },
    archived: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Archived teams keep their name reserved (DECISIONS D11).
teamSchema.index({ name: 1 }, { unique: true, collation: CASE_INSENSITIVE });
teamSchema.index({ inviteCode: 1 }, { unique: true, partialFilterExpression: { inviteCode: { $type: 'string' } } });
teamSchema.index({ memberIds: 1, archived: 1 });

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
module.exports.CASE_INSENSITIVE = CASE_INSENSITIVE;
