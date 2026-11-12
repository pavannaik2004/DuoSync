import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import HistoryList from '../components/HistoryList';
import useAsync from '../hooks/useAsync';
import { getProfile, myHistory } from '../api/users';

const joined = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });

/** /profile — AUTH-6 stats and SCORE-7 game history (`?page=`). */
export default function Profile() {
  const profile = useAsync(() => getProfile(), []);

  if (profile.loading) return <StatusMessage kind="loading" message="Loading your profile…" />;
  if (profile.error) {
    return (
      <StatusMessage
        kind="error"
        message={profile.error.message}
        action={<button type="button" className="btn" onClick={profile.reload}>Try again</button>}
      />
    );
  }
  const p = profile.data;

  return (
    <section className="page">
      <h1>
        <span className="avatar-dot" style={{ background: p.avatarColor }} aria-hidden="true" />
        {p.username}
      </h1>
      <p className="form-note">Joined {joined(p.joinedAt)}</p>

      <dl className="results-facts">
        <div><dt>Challenges played</dt><dd>{p.challengesPlayed}</dd></div>
        <div><dt>Total points</dt><dd>{p.totalPoints}</dd></div>
        <div><dt>Best rank</dt><dd>{p.bestRank ?? '–'}</dd></div>
      </dl>

      <h2 className="section-title">Teams</h2>
      {p.teams.length === 0 ? (
        <p className="form-note">No teams yet. <Link to="/teams">Start one</Link>.</p>
      ) : (
        <ul className="plain-list">
          {p.teams.map((t) => (
            <li key={t.id}>
              <Link to={`/teams/${t.id}`}>{t.name}</Link>
              {t.archived && <span className="form-note"> · archived</span>}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Game history</h2>
      <HistoryList load={myHistory} emptyText="You have not finished a challenge yet." />
    </section>
  );
}
