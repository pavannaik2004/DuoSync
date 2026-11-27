import PropTypes from 'prop-types';
import { Link, useSearchParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import TimerDisplay from '../components/game/TimerDisplay';
import useAsync from '../hooks/useAsync';
import { listThemes, themeRankings } from '../api/themes';

const SLUG = /^[a-z0-9-]{2,40}$/;
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** /rankings?theme= — SCORE-6: each team's best challenge result in one theme, top 20. */
export default function Rankings() {
  const [params, setParams] = useSearchParams();
  const themes = useAsync(() => listThemes(), []);
  const asked = SLUG.test(params.get('theme') || '') ? params.get('theme') : '';
  const slug = asked || themes.data?.[0]?.slug || '';

  return (
    <section className="page">
      <h1>Rankings</h1>
      <p className="form-note">Each team&rsquo;s best challenge result in a theme. Practice games are not ranked.</p>

      {themes.loading && <StatusMessage kind="loading" message="Loading themes…" />}
      {themes.error && (
        <StatusMessage
          kind="error"
          message={themes.error.message}
          action={<button type="button" className="btn" onClick={themes.reload}>Try again</button>}
        />
      )}
      {themes.data && (
        <div className="filters">
          <div className="field">
            <label htmlFor="rankings-theme">Theme</label>
            <select id="rankings-theme" value={slug} onChange={(e) => setParams({ theme: e.target.value })}>
              {themes.data.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
              {asked && !themes.data.some((t) => t.slug === asked) && <option value={asked}>(unavailable theme)</option>}
            </select>
          </div>
        </div>
      )}
      {slug && <RankingTable key={slug} slug={slug} />}
    </section>
  );
}

function RankingTable({ slug }) {
  const board = useAsync(() => themeRankings(slug), [slug]);
  if (board.loading) return <StatusMessage kind="loading" message="Loading rankings…" />;
  if (board.error) {
    return (
      <StatusMessage
        kind="error"
        message={board.error.message}
        action={<button type="button" className="btn" onClick={board.reload}>Try again</button>}
      />
    );
  }
  const { rows } = board.data;
  if (rows.length === 0) {
    return (
      <StatusMessage
        kind="empty"
        message="No finished challenges in this theme yet."
        action={<Link className="btn" to="/challenges">Find a challenge</Link>}
      />
    );
  }
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Rankings">
      <table className="results-table leaderboard-table">
        <caption className="visually-hidden">Best result per team</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Team</th>
            <th scope="col">Points</th>
            <th scope="col">Levels</th>
            <th scope="col">Time</th>
            <th scope="col">Stars</th>
            <th scope="col">Best run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId}>
              <td>{r.rank}</td>
              <th scope="row">{r.teamName}</th>
              <td>{r.points}</td>
              <td>{r.levelsCleared} of 5</td>
              <td>{TimerDisplay.format(r.timeUsedMs)}</td>
              <td>
                <span aria-hidden="true">{r.stars ? '★'.repeat(r.stars) : '–'}</span>
                <span className="visually-hidden">{r.stars} stars</span>
              </td>
              <td>{r.challengeName}{r.playedAt && <span className="form-note">, {day(r.playedAt)}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

RankingTable.propTypes = { slug: PropTypes.string.isRequired };
