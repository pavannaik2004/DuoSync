import PropTypes from 'prop-types';
import TimerDisplay from './TimerDisplay';
import { pauseShape, rolesShape } from './gameShapes';

/**
 * TIME-3 / §7.6: "Waiting for Decoder to reconnect — 0:42". The countdown is the server's grace left,
 * refreshed by every tick (D81); the client never counts down on its own. Text, not colour, says
 * whether the clock is stopped (NFR-16).
 */
export default function PauseBanner({ pause, roles, meId }) {
  const away = pause.away.filter((a) => a.id !== meId);
  if (away.length === 0) return null;
  return (
    <div className="pause-banner" role="status">
      {away.map((a) => (
        <p key={a.id}>
          Waiting for <strong>{a.role && roles[a.role] ? roles[a.role].name : a.name}</strong> to reconnect —{' '}
          <span className="pause-grace">{TimerDisplay.format(a.graceMs ?? 0)}</span>
        </p>
      ))}
      <p className="pause-clock">
        {pause.clockStopped ? 'Clock paused. Chat is still open.' : 'Pause budget used up — the clock is running.'}
      </p>
    </div>
  );
}

PauseBanner.propTypes = {
  pause: pauseShape.isRequired,
  roles: rolesShape.isRequired,
  meId: PropTypes.string.isRequired,
};
