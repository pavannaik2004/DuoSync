import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import TimerDisplay from './TimerDisplay';
import ChatPanel from './ChatPanel';
import { attemptShape } from './gameShapes';

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

/** Results (SCORE-2) and the team's chat log (CHAT-4). Practice is never ranked (PRAC-3). */
export default function Results({ state }) {
  const { result, theme } = state;
  return (
    <div className="results">
      <header className="results-head">
        <p className="lobby-kicker">{theme.name}</p>
        <h1>{HEADLINES[result.status]}</h1>
        <p className="results-text">{result.text}</p>
        <p className="results-total"><strong>{result.total}</strong> points</p>
        <Stars count={result.stars} />
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

      <p className="actions"><Link className="btn btn-primary" to="/practice">New practice room</Link></p>

      <section className="results-chat">
        <h2>Team chat</h2>
        <ChatPanel messages={state.chat} roles={theme.roles} />
      </section>
    </div>
  );
}

Results.propTypes = {
  state: attemptShape.isRequired,
};
