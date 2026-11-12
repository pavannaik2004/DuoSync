import PropTypes from 'prop-types';
import { Link, useSearchParams } from 'react-router-dom';
import StatusMessage from './StatusMessage';
import useAsync from '../hooks/useAsync';

const STATUS_TEXT = { finished: 'Finished', timed_out: "Time's up", ended_early: 'Ended early' };

/** `?page=` from the URL (Unit V query strings): a whole number from 1, else 1. */
function pageFrom(params) {
  const n = Number(params.get('page'));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');

/**
 * SCORE-7 / TEAM-6: one page of game history, newest first, with Previous and Next. The page
 * lives in the URL, so Back and Forward move between pages. `load(page)` returns the API page.
 */
export default function HistoryList({ load, emptyText }) {
  const [params, setParams] = useSearchParams();
  const page = pageFrom(params);
  const history = useAsync(() => load(page), [page]);

  const goTo = (next) => setParams((p) => {
    const copy = new URLSearchParams(p);
    if (next === 1) copy.delete('page');
    else copy.set('page', String(next));
    return copy;
  });

  if (history.loading) return <StatusMessage kind="loading" message="Loading games…" />;
  if (history.error) {
    return (
      <StatusMessage
        kind="error"
        message={history.error.message}
        action={<button type="button" className="btn" onClick={history.reload}>Try again</button>}
      />
    );
  }
  const { items, pages, total } = history.data;
  if (total === 0) return <StatusMessage kind="empty" message={emptyText} />;

  return (
    <div className="history">
      {items.length === 0 ? (
        <p className="form-note">There is nothing on this page.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Game history">
          <table className="results-table history-table">
            <caption className="visually-hidden">Games, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Challenge</th>
                <th scope="col">Team</th>
                <th scope="col">Points</th>
                <th scope="col">Rank</th>
                <th scope="col">Stars</th>
                <th scope="col">Date</th>
                <th scope="col"><span className="visually-hidden">Results</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((g) => (
                <tr key={g.attemptId}>
                  <th scope="row">
                    {g.challenge.code ? <Link to={`/challenge/${g.challenge.code}`}>{g.challenge.name}</Link> : g.challenge.name}
                    <span className="form-note"> · {g.theme.name}</span>
                    {g.status !== 'finished' && <span className="form-note"> · {STATUS_TEXT[g.status]}</span>}
                  </th>
                  <td>{g.team.name}</td>
                  <td>{g.points}</td>
                  <td>
                    {g.rank ? `${g.rank.position} of ${g.rank.outOf}` : '–'}
                    {g.rank?.provisional && <span className="form-note"> (so far)</span>}
                  </td>
                  <td>{g.stars} of 3</td>
                  <td>{dateText(g.finishedAt)}</td>
                  <td><Link to={`/results/${g.attemptId}`}>Results</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="pager" aria-label="Pages">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => goTo(page - 1)}>Previous</button>
        <span>Page {page} of {Math.max(pages, 1)}</span>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => goTo(page + 1)}>Next</button>
      </nav>
    </div>
  );
}

HistoryList.propTypes = { load: PropTypes.func.isRequired, emptyText: PropTypes.string.isRequired };
