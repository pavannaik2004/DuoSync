import { useCallback, useEffect, useState } from 'react';
import { connectSocket } from '../api/socket';
import { getLeaderboard } from '../api/challenges';

const ACK_TIMEOUT_MS = 10000;

/**
 * A challenge's live leaderboard (SCORE-3, D73). Opens its own socket and watches the board:
 * the ack brings the current board, then every `leaderboard:update` replaces it. If the socket
 * cannot connect, it falls back to the REST endpoint (UI-4). `version` grows with every new board,
 * so other panels can refresh when the board changes.
 * Returns { board, live, error, version, reload }.
 */
export default function useLeaderboard(challengeId) {
  const [board, setBoard] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    const socket = connectSocket();
    const show = (next) => {
      if (!active) return;
      setBoard(next);
      setError(null);
      setVersion((v) => v + 1);
    };
    const fallback = () => getLeaderboard(challengeId).then(show, (err) => active && setError(err));

    socket.on('connect', async () => {
      const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('leaderboard:watch', { challengeId }).catch(() => null);
      if (!active) return;
      if (ack && ack.ok) {
        setLive(true);
        show(ack.board);
      } else {
        setLive(false);
        fallback();
      }
    });
    socket.on('leaderboard:update', show);
    socket.on('disconnect', () => setLive(false));
    socket.on('connect_error', () => {
      setLive(false);
      fallback();
    });

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [challengeId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { board, live, error, version, reload };
}
