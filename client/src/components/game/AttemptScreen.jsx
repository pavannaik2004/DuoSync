import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import StatusMessage from '../StatusMessage';
import Lobby from './Lobby';
import GameScreen from './GameScreen';
import Results from './Results';
import useAttempt from '../../hooks/useAttempt';

/**
 * The lobby, the game and the results of one attempt. `target` is what useAttempt
 * joins: { practiceCode } or { attemptId }. `describeError` turns a join error into text.
 */
export default function AttemptScreen({ target, describeError, backLink }) {
  const { state, connection, error, actions, retry } = useAttempt(target);

  if (error && !state) {
    return (
      <StatusMessage
        kind="error"
        message={describeError(error)}
        action={(
          <>
            {error.error === 'NOT_OPEN' && <button type="button" className="btn btn-primary" onClick={retry}>Try again</button>}
            {backLink}
          </>
        )}
      />
    );
  }
  if (!state) return <StatusMessage kind="loading" message="Joining…" />;

  if (state.removed) {
    return (
      <StatusMessage
        kind="error"
        message="You were removed from this team, so you can't play this challenge."
        action={<Link className="btn" to="/dashboard">Back to the dashboard</Link>}
      />
    );
  }

  let screen = <Lobby state={state} actions={actions} />;
  if (state.status === 'in_progress') screen = <GameScreen state={state} actions={actions} />;
  else if (state.result) screen = <Results state={state} />;

  return (
    <div className="play">
      {connection !== 'online' && (
        <p className="offline-banner" role="status">
          {error ? error.message : 'Connection lost. Reconnecting…'}
          {error && <button type="button" className="btn" onClick={retry}>Retry</button>}
          {error?.error === 'AUTH_REQUIRED' && <Link className="btn" to="/login">Log in</Link>}
        </p>
      )}
      {screen}
    </div>
  );
}

AttemptScreen.propTypes = {
  target: PropTypes.oneOfType([
    PropTypes.shape({ practiceCode: PropTypes.string.isRequired }),
    PropTypes.shape({ attemptId: PropTypes.string.isRequired }),
  ]).isRequired,
  describeError: PropTypes.func.isRequired,
  backLink: PropTypes.node.isRequired,
};
