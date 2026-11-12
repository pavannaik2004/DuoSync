import PropTypes from 'prop-types';
import StatusMessage from './StatusMessage';
import useAsync from '../hooks/useAsync';
import { getChallengeTeams } from '../api/challenges';
import challengeMessage from '../utils/challengeErrors';

const STATUS_TEXT = {
  not_started: 'Not started',
  did_not_start: 'Did not start',
  in_progress: 'In progress',
  paused: 'Paused',
  finished: 'Finished',
  timed_out: "Time's up",
  ended_early: 'Ended early',
};

/** SCORE-5: every entered team's status, for the creator and organizers (D75). Refreshes when `version` changes. */
export default function TeamStatusTable({ challengeId, version }) {
  const teams = useAsync(() => getChallengeTeams(challengeId), [challengeId, version]);

  let body;
  if (teams.loading && !teams.data) body = <StatusMessage kind="loading" message="Loading teams…" />;
  else if (teams.error) {
    body = (
      <StatusMessage
        kind="error"
        message={challengeMessage(teams.error)}
        action={<button type="button" className="btn" onClick={teams.reload}>Try again</button>}
      />
    );
  } else if (teams.data.teams.length === 0) body = <p className="form-note">No team has entered yet.</p>;
  else {
    body = (
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Team status table">
        <table className="results-table">
          <caption className="visually-hidden">Every entered team and how far it got</caption>
          <thead>
            <tr><th scope="col">Team</th><th scope="col">Players</th><th scope="col">Status</th><th scope="col">Level</th><th scope="col">Points</th></tr>
          </thead>
          <tbody>
            {teams.data.teams.map((t) => (
              <tr key={t.teamId}>
                <th scope="row">{t.teamName}</th>
                <td>{t.members.join(', ')}</td>
                <td>{STATUS_TEXT[t.status] || t.status}</td>
                <td>{t.levelReached || '–'}</td>
                <td>{t.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section aria-labelledby="teams-title">
      <h2 id="teams-title" className="section-title">Every team (only you and organizers see this)</h2>
      {body}
    </section>
  );
}

TeamStatusTable.propTypes = { challengeId: PropTypes.string.isRequired, version: PropTypes.number.isRequired };
