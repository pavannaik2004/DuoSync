/**
 * Socket event handlers: validate the payload, check membership, then run the change
 * inside the attempt's queue and emit the results. Game rules live in services;
 * timers and shared emits live in flow.js.
 */
const Attempt = require('../models/Attempt');
const AppError = require('../utils/AppError');
const { openAttempt } = require('../services/challengeAttemptService');
const { joinPractice, findPractice } = require('../services/practiceService');
const { postMessage } = require('../services/chatService');
const lobby = require('../services/lobbyService');
const { submitAnswer, revealHint } = require('../services/gameService');
const { WRONG_COST, HINT_COST } = require('../services/scoring');
const { boardView, scoreOf, levelBar, clueFor, themeOf } = require('../services/attemptView');
const flow = require('./flow');
const { recoverOne } = require('./recovery');
const { str, int, oneOf } = require('./validate');
const { roomOf } = require('./runtime');

const CHAT_MAX = 300; // CHAT-1
const ANSWER_MAX = 40;

function errorBody(err) {
  if (err instanceof AppError) return { error: err.code, message: err.message };
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return { error: 'INTERNAL_ERROR', message: 'Something went wrong' };
}

/**
 * Wraps a handler. Replies through the ack when the client sent one ({ ok: true, ... }
 * or { error, message }); otherwise errors go out as an `error` event (DECISIONS D39).
 * Events are emitted before the ack, so a client's ack resolves after its updates.
 */
function handle(socket, fn) {
  return async (payload, ack) => {
    if (typeof payload === 'function') {
      ack = payload; // emitted with an ack but no payload
      payload = {};
    }
    const reply = typeof ack === 'function' ? ack : null;
    try {
      const extra = await fn(payload && typeof payload === 'object' ? payload : {});
      if (reply) reply({ ok: true, ...(extra || {}) });
    } catch (err) {
      const body = errorBody(err);
      if (reply) reply(body);
      else socket.emit('error', body);
    }
  };
}

/** Loads the socket's attempt and checks that the sender is one of its players (NFR-3). */
async function loadMembership(socket) {
  const { attemptId } = socket.data;
  const attempt = attemptId ? await Attempt.findById(attemptId) : null;
  const player = attempt && attempt.players.find((p) => p.id === socket.data.identity.id);
  if (!player) throw new AppError(403, 'NOT_IN_ATTEMPT', 'Join the game before doing that');
  return { attempt, player };
}

function registerHandlers(socket, runtimes) {
  const { identity } = socket.data;
  const runtimeOf = () => runtimes.get(socket.data.attemptId);

  /** Membership check, then `fn(runtime, player)` inside the attempt's queue. */
  const queued = (fn) => async () => {
    const { player } = await loadMembership(socket);
    const runtime = runtimeOf();
    return runtime.enqueue(() => fn(runtime, player));
  };

  /** Resolves the attempt to join: a practice room by code, or a challenge attempt by id (D58). */
  async function resolveJoin({ practiceCode, attemptId }) {
    if ((practiceCode === undefined) === (attemptId === undefined)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Send either a room code or an attempt id');
    }
    if (attemptId !== undefined) {
      const id = str(attemptId, { field: 'Attempt id', max: 64 });
      if (socket.data.attemptId && socket.data.attemptId !== id) {
        throw new AppError(409, 'ALREADY_IN_ATTEMPT', 'This connection is already in another game');
      }
      return String((await openAttempt(id, identity, Date.now()))._id);
    }
    const code = str(practiceCode, { field: 'Room code', max: 16 });
    // Compare rooms before joinPractice takes a seat, so a refused join leaves no player behind.
    const room = await findPractice(code);
    if (socket.data.attemptId && socket.data.attemptId !== String(room._id)) {
      throw new AppError(409, 'ALREADY_IN_ATTEMPT', 'This connection is already in another game');
    }
    return String((await joinPractice(code, identity))._id);
  }

  socket.on('attempt:join', handle(socket, async (payload) => {
    const attemptId = await resolveJoin(payload);
    const runtime = runtimes.get(attemptId);
    await runtime.enqueue(async () => {
      // The socket may have dropped while this job waited; a dead socket must not count as online.
      if (!socket.connected) return;
      // A removal can land between openAttempt and this job; re-check before entering the room.
      const current = await Attempt.findById(attemptId, { players: 1 });
      if (!current || !current.players.some((p) => p.id === identity.id)) {
        throw new AppError(403, 'NOT_IN_ATTEMPT', 'You are not on this team');
      }
      socket.data.attemptId = attemptId;
      socket.join(roomOf(attemptId));
      const first = runtime.addSocket(identity.id, socket);
      // Rebuild timers only for a runtime created after a restart (D37), never on later joins.
      if (!runtime.resumed) {
        runtime.resumed = true;
        await recoverOne(runtime, await Attempt.findById(attemptId));
      }
      let attempt = await Attempt.findById(attemptId);
      // TIME-4/TIME-6: an away player is back; a stopped clock runs again before their snapshot.
      const me = attempt.players.find((p) => p.id === identity.id);
      const back = first && me && me.awaySince ? await flow.playerBack(runtime, me) : null;
      if (back) attempt = await Attempt.findById(attemptId);
      if (first && !back && !Attempt.FINAL.includes(attempt.status)) {
        await flow.systemMessage(runtime, `${identity.name} joined`, { except: socket });
      }
      await flow.sendSnapshot(runtime, attempt, identity.id, socket);
      if (first) flow.broadcastLobby(runtime, attempt);
    });
  }));

  socket.on('chat:send', handle(socket, async ({ text }) => {
    const clean = str(text, { field: 'Message', max: CHAT_MAX });
    await queued(async (runtime, player) => {
      const msg = await postMessage(runtime.attemptId, { kind: 'user', senderName: player.name, role: player.role || null, text: clean });
      runtime.emitToRoom('chat:message', msg);
    })();
  }));

  socket.on('lobby:claimRole', handle(socket, async ({ role }) => {
    oneOf(role, ['A', 'B'], 'Role');
    await queued(async (runtime) => {
      flow.broadcastLobby(runtime, await lobby.claimRole(runtime.attemptId, identity.id, role));
    })();
  }));

  socket.on('lobby:releaseRole', handle(socket, queued(async (runtime) => {
    flow.broadcastLobby(runtime, await lobby.releaseRole(runtime.attemptId, identity.id));
  })));

  socket.on('lobby:ready', handle(socket, queued(async (runtime) => {
    const attempt = await lobby.setReady(runtime.attemptId, identity.id, {
      connectedIds: runtime.connectedIds(), now: Date.now(), countdownMs: runtime.options.countdownMs,
    });
    flow.broadcastLobby(runtime, attempt);
    if (attempt.status === 'countdown' && !runtime.countdownTimer) flow.startCountdown(runtime);
  })));

  socket.on('lobby:cancel', handle(socket, queued(async (runtime) => {
    const attempt = await lobby.unready(runtime.attemptId, identity.id);
    if (attempt.status === 'lobby') flow.cancelCountdown(runtime);
    flow.broadcastLobby(runtime, attempt);
  })));

  socket.on('level:submit', handle(socket, async ({ order, answer }) => {
    const level = int(order, { field: 'Level', min: 1, max: 5 });
    const text = str(answer, { field: 'Answer', max: ANSWER_MAX });
    const { player } = await loadMembership(socket);
    const runtime = runtimeOf();

    // §7.4: one submission per player every 2 seconds; a rejected one costs nothing.
    const now = Date.now();
    const last = runtime.lastSubmitAt.get(identity.id) || 0;
    if (now - last < runtime.options.submitGapMs) {
      throw new AppError(429, 'RATE_LIMITED', 'Wait 2 seconds between answers');
    }
    runtime.lastSubmitAt.set(identity.id, now);

    return runtime.enqueue(async () => {
      const outcome = await submitAnswer(runtime.attemptId, player, { order: level, answer: text }, Date.now());
      if (outcome.kind === 'ignored') return { ignored: true };
      const { attempt } = outcome;
      const theme = themeOf(attempt);
      const submittedBy = { id: player.id, name: player.name, role: player.role || null };

      if (outcome.kind === 'wrong') {
        runtime.emitToRoom('level:result', {
          order: level, correct: false, submittedBy, text, deduction: WRONG_COST, wrongCount: outcome.wrongCount,
        });
        const roleName = player.role ? theme.roles[player.role].name : player.name;
        await flow.systemMessage(runtime, `Wrong answer "${text}" from ${roleName} (−${WRONG_COST})`);
        return null;
      }

      const solved = attempt.levels[level - 1];
      runtime.emitToRoom('level:result', { order: level, correct: true, submittedBy, text, points: outcome.points });
      runtime.emitToRoom('board:update', { board: boardView(attempt), score: scoreOf(attempt), levels: levelBar(attempt) });
      await flow.systemMessage(runtime, `${solved.title} solved: +${outcome.points}`);
      if (outcome.finished) {
        await flow.finish(runtime, 'finished');
      } else {
        attempt.players.forEach((p) => {
          const clue = clueFor(attempt, p.id, { hintDelayMs: runtime.options.hintDelayMs });
          if (clue) runtime.emitToPlayer(p.id, 'level:unlocked', clue);
        });
        flow.scheduleHint(runtime, attempt);
      }
      return null;
    });
  }));

  socket.on('hint:reveal', handle(socket, async ({ order }) => {
    const level = int(order, { field: 'Level', min: 1, max: 5 });
    return queued(async (runtime, player) => {
      const outcome = await revealHint(runtime.attemptId, player, { order: level }, Date.now(), { hintDelayMs: runtime.options.hintDelayMs });
      if (outcome.kind === 'ignored') return { ignored: true };
      const roleName = player.role ? themeOf(outcome.attempt).roles[player.role].name : player.name;
      runtime.emitToRoom('hint:revealed', {
        order: level, hint: outcome.hint, revealedBy: { id: player.id, name: player.name, role: player.role || null },
      });
      await flow.systemMessage(runtime, `${roleName} revealed the hint (−${HINT_COST})`);
      return null;
    })();
  }));

  socket.on('attempt:quit', handle(socket, queued(async (runtime) => {
    const attempt = await Attempt.findById(runtime.attemptId);
    if (['lobby', 'countdown'].includes(attempt.status)) {
      throw new AppError(409, 'NOT_STARTED', 'The game has not started yet');
    }
    if (!(await flow.finish(runtime, 'ended_early'))) throw new AppError(409, 'ATTEMPT_OVER', 'This game is over');
  })));

  socket.on('disconnect', () => {
    if (!socket.data.attemptId) return;
    const runtime = runtimeOf();
    runtime.enqueue(async () => {
      if (!runtime.removeSocket(identity.id, socket)) return;
      let attempt = await Attempt.findById(runtime.attemptId);
      if (!attempt) return;
      if (['lobby', 'countdown'].includes(attempt.status)) {
        // A player who leaves the lobby is no longer ready, and a running countdown stops (LOBBY-3).
        attempt = await lobby.unready(runtime.attemptId, identity.id);
        flow.cancelCountdown(runtime);
      }
      if (['in_progress', 'paused'].includes(attempt.status)) {
        // TIME-3: the last socket of a player mid-game is gone: pause, and start the grace.
        const me = attempt.players.find((p) => p.id === identity.id);
        const away = me ? await flow.playerAway(runtime, me) : null;
        attempt = away || await Attempt.findById(runtime.attemptId);
      } else if (!Attempt.FINAL.includes(attempt.status)) {
        await flow.systemMessage(runtime, `${identity.name} left`);
      }
      if (!Attempt.FINAL.includes(attempt.status)) flow.broadcastLobby(runtime, attempt);
      if (Attempt.FINAL.includes(attempt.status)) runtime.release();
    }).catch(errorBody);
  });
}

module.exports = { registerHandlers, handle, loadMembership, errorBody };
