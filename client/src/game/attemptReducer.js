/**
 * Attempt state on the client. A snapshot replaces everything; the other events
 * change only what they carry. The server is the source of truth (NFR-8), so the
 * client never works out points or time on its own.
 */
const NO_PAUSE = { clockStopped: false, away: [], budgetLeftMs: null };

/** An away teammate as the banner shows them: name and role from the players list, grace from the server. */
function awayEntry(state, id, graceMs) {
  const known = (state.pause?.away || []).find((a) => a.id === id) || state.players.find((p) => p.id === id) || { id, name: 'Your teammate', role: null };
  return { id, name: known.name, role: known.role ?? null, graceMs };
}

/** While paused the status says so; when the clock runs again the game is in progress (D67). */
function statusFor(state, clockStopped) {
  if (clockStopped) return 'paused';
  return state.status === 'paused' ? 'in_progress' : state.status;
}

export default function attemptReducer(state, { type, payload }) {
  if (type === 'snapshot') return { ...payload, lastResult: state?.lastResult ?? null };
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
    case 'tick': {
      // D81: ticks carry whether the clock is stopped and each away teammate's grace left.
      if (payload.away === undefined) return { ...state, remainingMs: payload.remainingMs };
      const pause = {
        ...(state.pause || NO_PAUSE),
        clockStopped: Boolean(payload.paused),
        away: payload.away.map((a) => awayEntry(state, a.id, a.graceMs)),
      };
      return { ...state, remainingMs: payload.remainingMs, pause, status: statusFor(state, pause.clockStopped) };
    }
    case 'paused': {
      const clockStopped = payload.clockStopped || Boolean(state.pause?.clockStopped);
      const others = (state.pause?.away || []).filter((a) => a.id !== payload.who.id);
      const away = [...others, { ...payload.who, graceMs: payload.graceMs }];
      return { ...state, pause: { ...(state.pause || NO_PAUSE), clockStopped, away }, status: statusFor(state, clockStopped) };
    }
    case 'resumed': {
      const away = (state.pause?.away || []).filter((a) => !payload.who || a.id !== payload.who.id);
      return {
        ...state,
        remainingMs: payload.remainingMs,
        endsAt: payload.endsAt,
        pause: { ...(state.pause || NO_PAUSE), clockStopped: false, away },
        status: statusFor(state, false),
      };
    }
    case 'result': {
      const levels = payload.correct
        ? state.levels
        : state.levels.map((l) => (l.order === payload.order ? { ...l, wrongCount: payload.wrongCount } : l));
      const seq = state.lastResult ? state.lastResult.seq + 1 : 1;
      return { ...state, levels, lastResult: { ...payload, seq } };
    }
    case 'unlocked':
      return { ...state, clue: payload };
    case 'hintAvailable':
      if (!state.clue || state.clue.order !== payload.order) return state;
      return { ...state, clue: { ...state.clue, hint: { ...state.clue.hint, ready: true } } };
    case 'hintRevealed':
      if (!state.clue || state.clue.order !== payload.order) return state;
      return { ...state, clue: { ...state.clue, hint: { ready: true, text: payload.hint } } };
    case 'removed':
      return { ...state, removed: true, clue: null };
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
