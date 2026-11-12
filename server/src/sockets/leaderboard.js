/**
 * Live challenge leaderboards (SCORE-3, SCORE-4; §9.3; DECISIONS D73). Watchers join the read-only
 * room `leaderboard:<challengeId>`, which only ever receives `leaderboard:update` (NFR-4). Changes
 * are coalesced: however many arrive, a challenge's board is recomputed at most once per `delayMs`.
 */
const { leaderboardFor } = require('../services/leaderboardService');

const boardRoom = (challengeId) => `leaderboard:${challengeId}`;

function createLeaderboardHub(io, { delayMs }) {
  const pending = new Map(); // challengeId → timer

  return {
    /** Puts the socket in the challenge's room (leaving any other) and returns the current board. */
    async watch(socket, challengeId) {
      const board = await leaderboardFor(challengeId, Date.now()); // 404 for an unknown challenge
      const previous = socket.data.watching;
      if (previous && previous !== board.challengeId) socket.leave(boardRoom(previous));
      socket.data.watching = board.challengeId;
      socket.join(boardRoom(board.challengeId));
      return board;
    },

    /** Something on this challenge's board changed: broadcast a fresh board after `delayMs`. */
    changed(challengeId) {
      const id = challengeId && String(challengeId);
      if (!id || pending.has(id)) return;
      pending.set(id, setTimeout(async () => {
        pending.delete(id);
        try {
          io.to(boardRoom(id)).emit('leaderboard:update', await leaderboardFor(id, Date.now()));
        } catch (err) {
          console.error(`Leaderboard update failed for challenge ${id}:`, err);
        }
      }, delayMs));
    },

    stop() {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    },
  };
}

module.exports = { createLeaderboardHub, boardRoom };
