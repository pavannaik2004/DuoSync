import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { teamShape } from './shapes';

/** One team in the My Teams list (TEAM-3). Shows the partner, or that the seat is open. */
export default function TeamCard({ team, viewerId }) {
  const partner = team.members.find((m) => m.id !== viewerId);
  return (
    <li className="team-card">
      <Link to={`/teams/${team.id}`} className="team-card-link">
        <span className="team-card-name">{team.name}</span>
        <span className="team-card-meta">
          {partner ? <>With {partner.username}</> : <span className="seat-open">Waiting for a partner</span>}
          {team.isCaptain && <span className="badge">Captain</span>}
        </span>
        {team.record && (
          <span className="team-card-record">
            {team.record.played === 1 ? '1 challenge' : `${team.record.played} challenges`} · {team.record.totalPoints} points
          </span>
        )}
      </Link>
    </li>
  );
}

TeamCard.propTypes = {
  team: teamShape.isRequired,
  viewerId: PropTypes.string.isRequired,
};
