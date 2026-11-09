import PropTypes from 'prop-types';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import StatusMessage from './StatusMessage';

/**
 * Renders children only for the allowed kinds of identity. Anonymous visitors go
 * to /login?next=<this page> and come back afterwards (AUTH-4).
 */
export default function ProtectedRoute({ allow, children }) {
  const { status, refresh } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <StatusMessage kind="loading" message="Checking your session…" />;
  if (status === 'error') {
    return (
      <StatusMessage
        kind="error"
        message="Cannot reach the server to check your session."
        action={<button type="button" className="btn" onClick={refresh}>Try again</button>}
      />
    );
  }
  if (status === 'anon') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!allow.includes(status)) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <section className="page narrow">
        <h1>Players only</h1>
        <p>Guests can play practice games. Teams and challenges need an account.</p>
        <p className="actions">
          <Link className="btn btn-primary" to={`/signup?next=${next}`}>Create an account</Link>
          <Link className="btn" to={`/login?next=${next}`}>Log in</Link>
        </p>
      </section>
    );
  }
  return children;
}

ProtectedRoute.propTypes = {
  allow: PropTypes.arrayOf(PropTypes.oneOf(['user', 'guest'])).isRequired,
  children: PropTypes.node.isRequired,
};
