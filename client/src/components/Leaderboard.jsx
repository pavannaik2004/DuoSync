import PropTypes from 'prop-types';
import TimerDisplay from './game/TimerDisplay';

const STATUS_TEXT = { finished: 'Finished', timed_out: "Time's up", ended_early: 'Ended early' };

const boardShape = PropTypes.shape({
  status: PropTypes.string.isRequired,
  provisional: PropTypes.bool.isRequired,
  ranked: PropTypes.arrayOf(PropTypes.shape({
    rank: PropTypes.number.isRequired,
    teamId: PropTypes.string.isRequired,
    teamName: PropTypes.string.isRequired,
    points: PropTypes.number.isRequired,
    levelsCleared: PropTypes.number.isRequired,
    timeUsedMs: PropTypes.number.isRequired,
    stars: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
  })).isRequired,
  playing: PropTypes.arrayOf(PropTypes.shape({
    teamId: PropTypes.string.isRequired,
    teamName: PropTypes.string.isRequired,
    levelReached: PropTypes.number.isRequired,
    paused: PropTypes.bool.isRequired,
  })).isRequired,
  waiting: PropTypes.arrayOf(PropTypes.shape({
    teamId: PropTypes.string.isRequired,
    teamName: PropTypes.string.isRequired,
    didNotStart: PropTypes.bool.isRequired,
  })).isRequired,
});

/**
 * SCORE-3 / SCORE-4: ranked teams by the §7.3 order, teams playing now with their level, and teams
 * that have not started. Stars and statuses are text, not colour alone (NFR-16).
 */
export default function Leaderboard({ board, live }) {
  const waitingLabel = board.waiting.some((w) => w.didNotStart) ? 'Did not start' : 'Entered, not started yet';
  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <div className="page-head">
        <h2 id="leaderboard-title" className="section-title">Leaderboard</h2>
        <span className="badge">{board.provisional ? 'Provisional' : 'Final'}</span>
        {live && <span className="badge badge-ok">Live</span>}
      </div>

      {board.ranked.length === 0 ? (
        <p className="form-note">No team has finished yet.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Leaderboard table">
          <table className="results-table leaderboard-table">
            <caption className="visually-hidden">Teams ranked by points, then levels cleared, then time used</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Team</th>
                <th scope="col">Points</th>
                <th scope="col">Levels</th>
                <th scope="col">Time used</th>
                <th scope="col">Stars</th>
              </tr>
            </thead>
            <tbody>
              {board.ranked.map((r) => (
                <tr key={r.teamId}>
                  <td>{r.rank}</td>
                  <th scope="row">
                    {r.teamName}
                    {r.status !== 'finished' && <span className="form-note"> · {STATUS_TEXT[r.status]}</span>}
                  </th>
                  <td>{r.points}</td>
                  <td>{r.levelsCleared} of 5</td>
                  <td>{TimerDisplay.format(r.timeUsedMs)}</td>
                  <td>
                    <span aria-hidden="true">{'★'.repeat(r.stars)}</span>
                    <span className="visually-hidden">{r.stars} stars</span>
                    {r.stars === 0 && <span aria-hidden="true">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {board.playing.length > 0 && (
        <>
          <h3>Playing now</h3>
          <ul className="plain-list">
            {board.playing.map((p) => (
              <li key={p.teamId}>
                <strong>{p.teamName}</strong> · level {p.levelReached} of 5{p.paused && ' · paused'}
              </li>
            ))}
          </ul>
        </>
      )}

      {board.waiting.length > 0 && (
        <>
          <h3>{waitingLabel}</h3>
          <ul className="plain-list">
            {board.waiting.map((w) => <li key={w.teamId}>{w.teamName}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

Leaderboard.propTypes = { board: boardShape.isRequired, live: PropTypes.bool };
Leaderboard.defaultProps = { live: false };
