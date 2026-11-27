import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import HistoryList from '../components/HistoryList';
import ProfileEditor from '../components/ProfileEditor';
import { useAuth } from '../context/useAuth';
import { getToken } from '../api/client';
import useAsync from '../hooks/useAsync';
import { getProfile, myHistory } from '../api/users';

const joined = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'long' });

/** /profile — AUTH-6 stats, AUTH-7 editing and SCORE-7 game history (`?page=`). */
export default function Profile() {
  const profile = useAsync(() => getProfile(), []);
  const { user, login } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  function onSaved(updated) {
    profile.setData(updated);
    // The header shows the name from the auth context; same token, new name and colour.
    login({ token: getToken(), user: { ...user, username: updated.username, avatarColor: updated.avatarColor } });
    setEditing(false);
    setSaved(true);
  }

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
      {editing ? (
        <ProfileEditor profile={p} onSaved={onSaved} onCancel={() => setEditing(false)} />
      ) : (
        <p className="actions">
          <button type="button" className="btn" onClick={() => { setEditing(true); setSaved(false); }}>Edit profile</button>
          {saved && <span role="status" className="form-note">Profile saved.</span>}
        </p>
      )}

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
