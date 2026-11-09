/**
 * Attempt state on the client. A snapshot replaces everything; the other events
 * change only what they carry. The server is the source of truth (NFR-8), so the
 * client never works out points or time on its own.
 */
export default function attemptReducer(state, { type, payload }) {
  if (type === 'snapshot') return { ...payload, lastResult: null };
  if (!state) return state;

  switch (type) {
    case 'lobby': {
      const mine = payload.players.find((p) => p.id === state.me.id);
      return {
        ...state,
        status: payload.status,
        countdownEndsAt: payload.countdownEndsAt,
        players: payload.players,
        me: { ...state.me, role: mine ? mine.role : null },
      };
    }
    case 'tick':
      return { ...state, remainingMs: payload.remainingMs };
    case 'result': {
      const levels = payload.correct
        ? state.levels
        : state.levels.map((l) => (l.order === payload.order ? { ...l, wrongCount: payload.wrongCount } : l));
      const seq = state.lastResult ? state.lastResult.seq + 1 : 1;
      return { ...state, levels, lastResult: { ...payload, seq } };
    }
    case 'unlocked':
      return { ...state, clue: payload };
    case 'board':
      return { ...state, board: payload.board, score: payload.score, levels: payload.levels };
    case 'chat':
      return { ...state, chat: [...state.chat, payload] };
    case 'ended':
      return { ...state, status: payload.status, result: payload.result, clue: null, remainingMs: 0 };
    default:
      return state;
  }
}
