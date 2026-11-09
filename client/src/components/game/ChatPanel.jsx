import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { messageShape, rolesShape } from './gameShapes';

const MAX = 300; // CHAT-1

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Team chat (CHAT-1..5). Text is rendered as plain text, never as HTML.
 * Without `onSend` it is a read-only log (the results screen, CHAT-4).
 */
export default function ChatPanel({ messages, roles, onSend = null }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    const ack = await onSend(clean);
    setSending(false);
    if (ack.error) setError(ack.message);
    else {
      setText('');
      setError('');
    }
  }

  return (
    <section className="chat" aria-label="Team chat">
      <ol className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 && <li className="chat-empty">No messages yet. Say hello to your teammate.</li>}
        {messages.map((m) => (m.kind === 'system' ? (
          <li key={m.id} className="chat-system">
            <span>{m.text}</span>
            <time dateTime={m.createdAt}>{timeOf(m.createdAt)}</time>
          </li>
        ) : (
          <li key={m.id} className={`chat-msg ${m.role ? `role-${m.role.toLowerCase()}` : ''}`}>
            <span className="chat-meta">
              <strong>{m.senderName}</strong>
              {m.role && <span className="chat-role">{roles[m.role].name}</span>}
              <time dateTime={m.createdAt}>{timeOf(m.createdAt)}</time>
            </span>
            <span className="chat-text">{m.text}</span>
          </li>
        )))}
      </ol>
      {onSend && (
        <form className="chat-form" onSubmit={send}>
          <label className="visually-hidden" htmlFor="chat-input">Message your teammate</label>
          <input
            id="chat-input"
            value={text}
            maxLength={MAX}
            autoComplete="off"
            placeholder="Describe what you see…"
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn" disabled={sending || !text.trim()}>Send</button>
          <span className="chat-count" aria-live="off">{text.length}/{MAX}</span>
          {error && <p className="field-error" role="alert">{error}</p>}
        </form>
      )}
    </section>
  );
}

ChatPanel.propTypes = {
  messages: PropTypes.arrayOf(messageShape).isRequired,
  roles: rolesShape.isRequired,
  onSend: PropTypes.func,
};
