const mongoose = require('mongoose');

// Team chat lives in its own collection so attempts don't grow without limit (PRD §9.1).
const messageSchema = new mongoose.Schema(
  {
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
    kind: { type: String, enum: ['user', 'system'], required: true },
    senderName: { type: String, default: null },
    role: { type: String, enum: ['A', 'B', null], default: null },
    text: { type: String, required: true, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ attemptId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
