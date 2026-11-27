import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import AdminError from '../../components/admin/AdminError';
import useAsync from '../../hooks/useAsync';
import { searchUsers, setOrganizer } from '../../api/admin';

const rolesText = (roles) => roles.filter((r) => r !== 'player').join(', ') || 'player';

/** ADMIN-6: find users by username or email and grant or remove the organizer role (D90). */
export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim().slice(0, 40);
  const users = useAsync(() => (q.length >= 2 ? searchUsers(q) : Promise.resolve(null)), [q]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  function onSearch(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q').trim();
    setParams(value ? { q: value } : {});
  }

  async function toggle(user) {
    const on = !user.roles.includes('organizer');
    setBusy(user.id);
    setError(null);
    try {
      const updated = await setOrganizer(user.id, on);
      users.setData((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="page">
      <h1>Users</h1>
      <p className="form-note">Organizers can create public challenges and see every team in them. The admin role is set only by the seed script.</p>
      <form className="filters" onSubmit={onSearch} key={q} role="search" aria-label="Find users">
        <div className="field">
          <label htmlFor="user-q">Username or email</label>
          <input id="user-q" name="q" type="search" defaultValue={q} minLength={2} maxLength={40} />
        </div>
        <button type="submit" className="btn">Search</button>
      </form>
      {q.length === 1 && <p className="field-error">Enter at least 2 characters.</p>}
      <AdminError error={error} />
      {users.loading && <StatusMessage kind="loading" message="Searching…" />}
      {users.error && <AdminError error={users.error} />}
      {users.data && !users.loading && (users.data.length === 0 ? (
        <StatusMessage kind="empty" message="No users match." />
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Users">
          <table className="results-table">
            <caption className="visually-hidden">Users matching the search, at most 20</caption>
            <thead>
              <tr>
                <th scope="col">Username</th>
                <th scope="col">Email</th>
                <th scope="col">Roles</th>
                <th scope="col"><span className="visually-hidden">Organizer</span></th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <th scope="row">{u.username}</th>
                  <td>{u.email}</td>
                  <td>{rolesText(u.roles)}</td>
                  <td>
                    <button type="button" className="btn" disabled={busy === u.id} onClick={() => toggle(u)}>
                      {u.roles.includes('organizer') ? 'Remove organizer' : 'Make organizer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
