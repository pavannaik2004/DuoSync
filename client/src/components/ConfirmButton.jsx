import { useState } from 'react';
import PropTypes from 'prop-types';

/** A button that asks for a second click before acting, for actions that are hard to undo. */
export default function ConfirmButton({ label, confirmLabel, onConfirm, danger = false, busy = false }) {
  const [armed, setArmed] = useState(false);
  const tone = danger ? 'btn btn-danger' : 'btn';

  if (!armed) {
    return (
      <button type="button" className={tone} onClick={() => setArmed(true)} disabled={busy}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={`Confirm: ${label}`}>
      <button
        type="button"
        className={tone}
        disabled={busy}
        onClick={async () => {
          await onConfirm();
          setArmed(false);
        }}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setArmed(false)} disabled={busy}>
        Cancel
      </button>
    </span>
  );
}

ConfirmButton.propTypes = {
  label: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  danger: PropTypes.bool,
  busy: PropTypes.bool,
};
