import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Layout() {
  const { status, user, guest, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <Link to={status === 'anon' ? '/' : '/dashboard'} className="wordmark" aria-label="DuoSync home">
          <span className="wordmark-a">Duo</span><span className="wordmark-b">Sync</span>
        </Link>
        <nav aria-label="Main">
          {status === 'user' && (
            <>
              <NavLink to="/teams">My teams</NavLink>
              <NavLink to="/practice">Practice</NavLink>
              <NavLink to="/profile">Profile</NavLink>
              <span className="who" title="Signed in">{user.username}</span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>Log out</button>
            </>
          )}
          {status === 'guest' && (
            <>
              <NavLink to="/practice">Practice</NavLink>
              <span className="who" title="Playing as guest">{guest.nickname} (guest)</span>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>Leave</button>
            </>
          )}
          {status === 'anon' && (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link className="btn btn-primary" to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main id="main" className="site-main">
        <Outlet />
      </main>
    </>
  );
}
