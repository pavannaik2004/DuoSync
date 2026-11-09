import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const SLOW_AFTER_MS = 5000;

/** Shows a hint once a loading state has lasted a while: the free server sleeps when idle. */
function SlowHint() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return null;
  return <p className="status-hint">The server may be waking up. This can take up to a minute.</p>;
}

/** Loading, empty and error states for any page that loads data (UI-4). */
export default function StatusMessage({ kind, message, action = null }) {
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <div className={`status status-${kind}`} role={role}>
      {kind === 'loading' && <span className="spinner" aria-hidden="true" />}
      {kind === 'error' && <span className="status-icon" aria-hidden="true">!</span>}
      <p>{message}</p>
      {kind === 'loading' && <SlowHint />}
      {action}
    </div>
  );
}

StatusMessage.propTypes = {
  kind: PropTypes.oneOf(['loading', 'error', 'empty']).isRequired,
  message: PropTypes.string.isRequired,
  action: PropTypes.node,
};
