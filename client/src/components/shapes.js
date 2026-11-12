import PropTypes from 'prop-types';

/** PropTypes for API objects shared by several components. */
export const memberShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired,
  avatarColor: PropTypes.string,
});

/** The team view from GET /api/teams/:id. */
export const teamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  captainId: PropTypes.string.isRequired,
  members: PropTypes.arrayOf(memberShape).isRequired,
  isCaptain: PropTypes.bool.isRequired,
  inviteCode: PropTypes.string,
  record: PropTypes.shape({ played: PropTypes.number.isRequired, totalPoints: PropTypes.number.isRequired }), // TEAM-3
});
