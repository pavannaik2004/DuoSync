const mongoose = require('mongoose');
const patterns = require('../utils/patterns');

const AVATAR_COLORS = ['#E4572E', '#29335C', '#F3A712', '#669BBC', '#A8C686', '#7D5BA6', '#2A9D8F', '#D1495B'];
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      match: [patterns.USERNAME, 'Username must be 3-20 letters, digits or underscores'],
    },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    roles: {
      type: [{ type: String, enum: ['player', 'organizer', 'admin'] }],
      default: ['player'],
    },
    avatarColor: {
      type: String,
      default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(doc, ret) {
        return {
          id: String(ret._id),
          username: ret.username,
          email: ret.email,
          roles: ret.roles,
          avatarColor: ret.avatarColor,
          createdAt: ret.createdAt,
        };
      },
    },
  },
);

// "Alice" and "alice" are the same username (DECISIONS D7).
userSchema.index({ username: 1 }, { unique: true, collation: CASE_INSENSITIVE });
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.CASE_INSENSITIVE = CASE_INSENSITIVE;
module.exports.AVATAR_COLORS = AVATAR_COLORS;
