import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { connectSocket } from '../api/socket';
import attemptReducer from '../game/attemptReducer';

const ACK_TIMEOUT_MS = 10000;
const NO_ANSWER = { error: 'TIMEOUT', message: 'The server did not answer. Try again.' };

const EVENTS = {
  'attempt:snapshot': 'snapshot',
  'lobby:update': 'lobby',
  'attempt:tick': 'tick',
  'level:result': 'result',
  'level:unlocked': 'unlocked',
  'board:update': 'board',
  'chat:message': 'chat',
  'attempt:ended': 'ended',
};

/**
 * Live state of one practice room. Joins on every (re)connect, so a dropped
 * connection or a page refresh gets a fresh snapshot (TIME-6).
 * Returns { state, connection, error, actions, retry }; every action resolves with the ack.
 */
export default function useAttempt(code) {
  const [state, dispatch] = useReducer(attemptReducer, null);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', async () => {
      setConnection('online');
      const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('attempt:join', { practiceCode: code }).catch(() => NO_ANSWER);
      setError(ack.error ? ack : null);
    });
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', (err) => {
      setConnection('offline');
      setError(err.message === 'AUTH_REQUIRED'
        ? { error: 'AUTH_REQUIRED', message: 'Your session has ended. Log in again.' }
        : { error: 'CONNECT_ERROR', message: 'Could not reach the server.' });
    });
    Object.entries(EVENTS).forEach(([event, type]) => {
      socket.on(event, (payload) => dispatch({ type, payload }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [code]);

  const emit = useCallback((event, payload) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return Promise.resolve({ error: 'OFFLINE', message: 'You are offline. Reconnecting…' });
    return socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload ?? {}).catch(() => NO_ANSWER);
  }, []);

  const actions = useMemo(() => ({
    claimRole: (role) => emit('lobby:claimRole', { role }),
    releaseRole: () => emit('lobby:releaseRole'),
    ready: () => emit('lobby:ready'),
    cancel: () => emit('lobby:cancel'),
    sendChat: (text) => emit('chat:send', { text }),
    submit: (order, answer) => emit('level:submit', { order, answer }),
    quit: () => emit('attempt:quit'),
  }), [emit]);

  const retry = useCallback(() => socketRef.current?.connect(), []);

  return { state, connection, error, actions, retry };
}
