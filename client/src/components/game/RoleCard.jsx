import PropTypes from 'prop-types';
import { playerShape, roleShape } from './gameShapes';

/**
 * One in-game role in the lobby (LOBBY-2): who holds it, whether they are online
 * and ready, and the claim or release button. A role the partner holds is locked.
 */
export default function RoleCard({ letter, role, holder = null, isMine, canClaim, busy, onClaim, onRelease }) {
  const tone = `role-card role-${letter.toLowerCase()}${isMine ? ' is-mine' : ''}`;
  return (
    <article className={tone} aria-label={`Role ${letter}: ${role.name}`}>
      <header className="role-card-head">
        <span className="role-letter" aria-hidden="true">{letter}</span>
        <h3>{role.name}</h3>
      </header>
      <p className="role-desc">{role.description}</p>
      <p className="role-holder">
        {holder ? (
          <>
            <span className={`presence ${holder.connected ? 'is-online' : 'is-offline'}`}>
              {holder.connected ? 'Online' : 'Offline'}
            </span>
            <strong>{isMine ? 'You' : holder.name}</strong>
            {holder.ready && <span className="badge badge-ok">✓ Ready</span>}
          </>
        ) : (
          <span className="role-open">Nobody yet</span>
        )}
      </p>
      {isMine && (
        <button type="button" className="btn btn-ghost" onClick={onRelease} disabled={busy}>Give up this role</button>
      )}
      {!holder && (
        <button type="button" className="btn btn-role" onClick={onClaim} disabled={busy || !canClaim}>
          Play as {role.name}
        </button>
      )}
    </article>
  );
}

RoleCard.propTypes = {
  letter: PropTypes.oneOf(['A', 'B']).isRequired,
  role: roleShape.isRequired,
  holder: playerShape,
  isMine: PropTypes.bool.isRequired,
  canClaim: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onClaim: PropTypes.func.isRequired,
  onRelease: PropTypes.func.isRequired,
};
