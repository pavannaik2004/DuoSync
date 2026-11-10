import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import Lobby from '../components/game/Lobby';
import GameScreen from '../components/game/GameScreen';
import Results from '../components/game/Results';
import useAttempt from '../hooks/useAttempt';
import { patterns } from '../utils/validators';

const JOIN_ERRORS = {
  PRACTICE_NOT_FOUND: 'No practice room has that code. Check it with your teammate.',
  ROOM_FULL: 'This room already has 2 players.',
  ALREADY_STARTED: 'This game started without you. Ask for a new room.',
};

const backLink = <Link className="btn" to="/practice">Back to practice</Link>;

function PlayRoom({ code }) {
  const { state, connection, error, actions, retry } = useAttempt(code);

  if (error && !state) {
    return <StatusMessage kind="error" message={JOIN_ERRORS[error.error] || error.message} action={backLink} />;
  }
  if (!state) return <StatusMessage kind="loading" message="Joining the room…" />;

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

PlayRoom.propTypes = { code: PropTypes.string.isRequired };

/** /play/:code — the lobby, the attempt and the results for one practice room. */
export default function PlayPage() {
  const { code = '' } = useParams();
  if (!patterns.PRACTICE_CODE.test(code)) {
    return <StatusMessage kind="error" message="That room code doesn't look right. Room codes have 6 letters and digits." action={backLink} />;
  }
  return <PlayRoom key={code} code={code.toUpperCase()} />;
}
