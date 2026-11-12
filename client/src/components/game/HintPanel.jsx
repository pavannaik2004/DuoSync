import { useState } from 'react';
import PropTypes from 'prop-types';
import ConfirmButton from '../ConfirmButton';

/** GAME-10: the level's hint. Locked until the server says it is ready, then a one-time paid reveal. */
export default function HintPanel({ hint, onReveal, disabled }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError('');
    const ack = await onReveal();
    if (ack?.error) setError(ack.message);
    setBusy(false);
  }

  let body;
  if (hint.text) body = <p className="hint-text">{hint.text}</p>;
  else if (hint.ready && disabled) body = <p className="form-note">Paused while your teammate reconnects</p>;
  else if (hint.ready) body = <ConfirmButton label="Reveal hint (−25 points)" confirmLabel="Yes, reveal (−25 points)" busy={busy} onConfirm={reveal} />;
  else body = <p className="form-note">Hint unlocks 90 seconds into the level</p>;

  return (
    <aside className="hint-panel" aria-label="Hint">
      <h3>Hint</h3>
      <div aria-live="polite">{body}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </aside>
  );
}

HintPanel.propTypes = {
  hint: PropTypes.shape({ ready: PropTypes.bool.isRequired, text: PropTypes.string }).isRequired,
  onReveal: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

HintPanel.defaultProps = { disabled: false };
