import PropTypes from 'prop-types';
import TimerDisplay from './TimerDisplay';
import ChatPanel from './ChatPanel';
import { messageShape, rankShape, resultShape, rolesShape } from './gameShapes';

const HEADLINES = {
  finished: 'Finished',
  timed_out: "Time's up",
  ended_early: 'Ended early',
};

function Stars({ count }) {
  return (
    <p className="stars">
      <span aria-hidden="true">{'★'.repeat(count)}{'☆'.repeat(3 - count)}</span>
      <span>{count} of 3 stars</span>
    </p>
  );
}

Stars.propTypes = { count: PropTypes.number.isRequired };

/** SCORE-2: the team's current place. Provisional until the challenge has closed (D74). */
function Rank({ rank }) {
  return (
    <p className="results-rank">
      Rank <strong>{rank.position}</strong> of {rank.outOf}
      {rank.provisional && <span className="form-note"> (provisional: other teams may still play)</span>}
    </p>
  );
}

Rank.propTypes = { rank: rankShape.isRequired };

/**
 * Results (SCORE-2) and the team's chat log (CHAT-4). Practice is never ranked (PRAC-3).
 * `actions` are the links under the table: a new practice room, or back to the challenge.
 */
export default function Results({
  result, theme, chat, actions,
}) {
  return (
    <div className="results">
      <header className="results-head">
        <p className="lobby-kicker">{theme.name}</p>
        <h1>{HEADLINES[result.status]}</h1>
        <p className="results-text">{result.text}</p>
        <p className="results-total"><strong>{result.total}</strong> points</p>
        <Stars count={result.stars} />
        {result.rank && <Rank rank={result.rank} />}
      </header>

      <div className="table-scroll">
        <table className="results-table">
          <caption className="visually-hidden">Points per level</caption>
          <thead>
            <tr><th scope="col">Level</th><th scope="col">Solved</th><th scope="col">Wrong</th><th scope="col">Points</th></tr>
          </thead>
          <tbody>
            {result.levels.map((l) => (
              <tr key={l.order}>
                <th scope="row">{l.order}. {l.title}</th>
                <td>{l.solved ? '✓ Yes' : '✗ No'}</td>
                <td>{l.wrongCount}</td>
                <td>{l.points}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={3}>Level points</th><td>{result.levelPoints}</td></tr>
            <tr><th scope="row" colSpan={3}>Time bonus</th><td>{result.bonus}</td></tr>
            <tr><th scope="row" colSpan={3}>Total</th><td><strong>{result.total}</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <dl className="results-facts">
        <div><dt>Levels cleared</dt><dd>{result.levelsCleared} of 5</dd></div>
        <div><dt>Wrong answers</dt><dd>{result.wrongAnswers}</dd></div>
        <div><dt>Time used</dt><dd>{TimerDisplay.format(result.timeUsedMs)}</dd></div>
      </dl>

      {actions && <p className="actions">{actions}</p>}

      <section className="results-chat">
        <h2>Team chat</h2>
        <ChatPanel messages={chat} roles={theme.roles} />
      </section>
    </div>
  );
}

Results.propTypes = {
  result: resultShape.isRequired,
  theme: PropTypes.shape({ name: PropTypes.string.isRequired, roles: rolesShape.isRequired }).isRequired,
  chat: PropTypes.arrayOf(messageShape).isRequired,
  actions: PropTypes.node,
};

Results.defaultProps = { actions: null };
