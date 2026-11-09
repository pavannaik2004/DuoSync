const Message = require('../models/Message');
const { messageView } = require('./attemptView');

const LOG_LIMIT = 500;

/** Saves a team or system message and returns it as clients see it (CHAT-1, CHAT-2). */
async function postMessage(attemptId, { kind, senderName = null, role = null, text }) {
  const msg = await Message.create({ attemptId, kind, senderName, role, text });
  return messageView(msg);
}

/** The attempt's chat log, oldest first (CHAT-3). */
async function recentMessages(attemptId) {
  const messages = await Message.find({ attemptId }).sort({ createdAt: -1, _id: -1 }).limit(LOG_LIMIT);
  return messages.reverse();
}

module.exports = { postMessage, recentMessages };
