import PropTypes from 'prop-types';
import { Link, useSearchParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import useAsync from '../hooks/useAsync';
import { listChallenges } from '../api/challenges';
import { listThemes } from '../api/themes';
import { formatLocal } from '../utils/time';

const STATUSES = [['all', 'All'], ['upcoming', 'Upcoming'], ['open', 'Open'], ['closed', 'Closed']];
const STATUS_TEXT = { upcoming: 'Upcoming', open: 'Open', closing: 'Closing', closed: 'Closed' };

/** The filters live in the URL (Unit V query strings), so a filtered list can be bookmarked and Back works. */
function filtersFrom(params) {
  const status = STATUSES.some(([v]) => v === params.get('status')) ? params.get('status') : 'all';
  const theme = /^[a-z0-9-]{1,40}$/.test(params.get('theme') || '') ? params.get('theme') : '';
  const n = Number(params.get('page'));
  return { status, theme, page: Number.isInteger(n) && n >= 1 ? n : 1 };
}

/** CHAL-4: public challenges as upcoming, open or closed, with a filter form by theme and status. */
export default function ChallengesList() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFrom(params);
  const list = useAsync(() => listChallenges(filters), [filters]);
  const themes = useAsync(() => listThemes(), []);

  const apply = (next) => {
    const copy = new URLSearchParams();
    if (next.status !== 'all') copy.set('status', next.status);
    if (next.theme) copy.set('theme', next.theme);
    if (next.page > 1) copy.set('page', String(next.page));
    setParams(copy);
  };

  function onSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    apply({ status: data.get('status'), theme: data.get('theme'), page: 1 });
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>Challenges</h1>
        <Link className="btn" to="/challenges/new">Create a challenge</Link>
      </div>
      <p className="form-note">Public challenges anyone can enter with a team. Private ones are reached only by their code.</p>

      <form className="filters" onSubmit={onSubmit} key={params.toString()} aria-label="Filter challenges">
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" name="status" defaultValue={filters.status}>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-theme">Theme</label>
          <select id="filter-theme" name="theme" defaultValue={filters.theme}>
            <option value="">All themes</option>
            {(themes.data || []).map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn">Apply</button>
      </form>

      {list.loading && <StatusMessage kind="loading" message="Loading challenges…" />}
      {list.error && (
        <StatusMessage
          kind="error"
          message={list.error.message}
          action={<button type="button" className="btn" onClick={list.reload}>Try again</button>}
        />
      )}
      {list.data && !list.loading && <Results data={list.data} onPage={(page) => apply({ ...filters, page })} />}
    </section>
  );
}

function Results({ data, onPage }) {
  const { items, page, pageSize, total } = data;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return <StatusMessage kind="empty" message="No public challenges match these filters." />;
  return (
    <>
      {items.length === 0 ? (
        <p className="form-note">There is nothing on this page.</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Public challenges">
          <table className="results-table">
            <caption className="visually-hidden">Public challenges</caption>
            <thead>
              <tr>
                <th scope="col">Challenge</th>
                <th scope="col">Status</th>
                <th scope="col">Window (your time)</th>
                <th scope="col">Teams</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <Link to={`/challenge/${c.code}`}>{c.name}</Link>
                    <span className="form-note"> · {c.theme.name}</span>
                  </th>
                  <td>{STATUS_TEXT[c.status] || c.status}</td>
                  <td>{formatLocal(c.startsAt)} – {formatLocal(c.endsAt)}</td>
                  <td>{c.teamsEntered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="pager" aria-label="Pages">
        <button type="button" className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </nav>
    </>
  );
}

Results.propTypes = {
  data: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      code: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      theme: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
      status: PropTypes.string.isRequired,
      startsAt: PropTypes.string.isRequired,
      endsAt: PropTypes.string.isRequired,
      teamsEntered: PropTypes.number.isRequired,
    })).isRequired,
    page: PropTypes.number.isRequired,
    pageSize: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
  }).isRequired,
  onPage: PropTypes.func.isRequired,
};
