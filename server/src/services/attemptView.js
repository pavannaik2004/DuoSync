/**
 * The only way attempt data reaches a client (roadmap; NFR-1). Every function copies
 * named fields: a level is never spread, so answers, accepted answers, explanations,
 * hints and the partner's clue half cannot leak.
 */
const { FINAL } = require('../models/Attempt');
const { getContent } = require('../content');
const { summarize, starsFor } = require('./scoring');

const iso = (date) => (date ? new Date(date).toISOString() : null);
const isFinal = (attempt) => FINAL.includes(attempt.status);

function currentIndex(attempt) {
  if (attempt.status !== 'in_progress') return -1;
  return attempt.levels.findIndex((l) => !l.solvedAt);
}

/** Level bar: solved (with points), current or locked. Empty before the start. */
function levelBar(attempt) {
  const current = currentIndex(attempt);
  return attempt.levels.map((l, i) => {
    let state = 'locked';
    if (l.solvedAt) state = 'solved';
    else if (i === current) state = 'current';
    return { order: l.order, title: l.title, state, points: l.solvedAt ? l.points : 0, wrongCount: l.wrongCount };
  });
}

function playersView(attempt, connectedIds) {
  return attempt.players.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role || null,
    ready: Boolean(p.ready),
    connected: connectedIds.includes(p.id),
  }));
}

function lobbyView(attempt, connectedIds = []) {
  return {
    status: attempt.status,
    countdownEndsAt: iso(attempt.countdownEndsAt),
    players: playersView(attempt, connectedIds),
  };
}

function messageView(msg) {
  return {
    id: String(msg._id),
    kind: msg.kind,
    senderName: msg.senderName || null,
    role: msg.role || null,
    text: msg.text,
    createdAt: iso(msg.createdAt),
  };
}

/** The player's own role's half of the current level, or null. */
function clueFor(attempt, playerId) {
  const player = attempt.players.find((p) => p.id === playerId);
  const index = currentIndex(attempt);
  if (!player || !player.role || index === -1) return null;
  const level = attempt.levels[index];
  return { order: level.order, title: level.title, clue: player.role === 'A' ? level.clueA : level.clueB };
}

function boardView(attempt) {
  return attempt.board.map((b) => ({ order: b.order, title: b.title, reward: b.reward }));
}

function scoreOf(attempt) {
  return attempt.levels.reduce((sum, l) => sum + (l.solvedAt ? l.points : 0), 0);
}

/** Results breakdown (SCORE-2). Null until the attempt is final. Never includes answers (D38). */
function resultView(attempt) {
  if (!isFinal(attempt)) return null;
  const { theme } = getContent(attempt.themeSlug);
  const summary = summarize(attempt.levels, { remainingMs: 0 });
  const bonus = summary.levelsCleared === attempt.levels.length && attempt.levels.length > 0 ? attempt.bonus || 0 : 0;
  const total = summary.levelPoints + bonus;
  return {
    status: attempt.status,
    levels: attempt.levels.map((l) => ({
      order: l.order, title: l.title, solved: Boolean(l.solvedAt), points: l.solvedAt ? l.points : 0, wrongCount: l.wrongCount,
    })),
    levelPoints: summary.levelPoints,
    bonus,
    total,
    stars: starsFor({ total, levelsCleared: summary.levelsCleared }),
    levelsCleared: summary.levelsCleared,
    wrongAnswers: summary.wrongAnswers,
    timeUsedMs: attempt.timeUsedMs || 0,
    text: attempt.status === 'finished' ? theme.revealText : theme.failText,
  };
}

/** Full state for one player: snapshot on join, start and reconnect. */
function toPlayerView(attempt, playerId, { connectedIds = [], messages = [], now = Date.now() } = {}) {
  const { theme } = getContent(attempt.themeSlug);
  const me = attempt.players.find((p) => p.id === playerId);
  return {
    id: String(attempt._id),
    practiceCode: attempt.practiceCode || null,
    status: attempt.status,
    theme: { slug: theme.slug, name: theme.name, story: theme.story, timerMinutes: attempt.timerMinutes, roles: theme.roles },
    me: { id: playerId, role: (me && me.role) || null },
    players: playersView(attempt, connectedIds),
    countdownEndsAt: iso(attempt.countdownEndsAt),
    startedAt: iso(attempt.startedAt),
    endsAt: iso(attempt.endsAt),
    remainingMs: attempt.endsAt ? Math.max(0, new Date(attempt.endsAt).getTime() - now) : null,
    levels: levelBar(attempt),
    clue: clueFor(attempt, playerId),
    board: boardView(attempt),
    score: scoreOf(attempt),
    chat: messages.map(messageView),
    result: resultView(attempt),
  };
}

module.exports = {
  toPlayerView, lobbyView, levelBar, messageView, clueFor, boardView, scoreOf, resultView,
};
