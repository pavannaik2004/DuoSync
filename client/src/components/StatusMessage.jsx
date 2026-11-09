import PropTypes from 'prop-types';

/** Loading, empty and error states for any page that loads data (UI-4). */
export default function StatusMessage({ kind, message, action = null }) {
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <div className={`status status-${kind}`} role={role}>
      {kind === 'loading' && <span className="spinner" aria-hidden="true" />}
      {kind === 'error' && <span className="status-icon" aria-hidden="true">!</span>}
      <p>{message}</p>
      {action}
    </div>
  );
}

StatusMessage.propTypes = {
  kind: PropTypes.oneOf(['loading', 'error', 'empty']).isRequired,
  message: PropTypes.string.isRequired,
  action: PropTypes.node,
};
