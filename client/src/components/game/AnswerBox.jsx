import { useState } from 'react';
import PropTypes from 'prop-types';

const MAX = 40;
const MESSAGES = { RATE_LIMITED: 'Wait 2 seconds between answers.' };

/**
 * The answer form. It passes the answer up to the game page (child to parent,
 * §10.1 Unit II) and shows the server's reply. Either teammate can answer (GAME-4).
 */
export default function AnswerBox({ order, onSubmit }) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!answer.trim()) {
      setError('Type an answer first.');
      return;
    }
    setSending(true);
    const ack = await onSubmit(answer.trim());
    setSending(false);
    if (ack.error) {
      setError(MESSAGES[ack.error] || ack.message);
      return;
    }
    setError('');
    setAnswer('');
  }

  return (
    <form className="answer-box" onSubmit={submit} noValidate>
      <label htmlFor={`answer-${order}`}>Your team&apos;s answer</label>
      <div className="answer-row">
        <input
          id={`answer-${order}`}
          value={answer}
          maxLength={MAX}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `answer-error-${order}` : undefined}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Checking…' : 'Submit'}</button>
      </div>
      {error && <p className="field-error" id={`answer-error-${order}`} role="alert">{error}</p>}
    </form>
  );
}

AnswerBox.propTypes = {
  order: PropTypes.number.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
