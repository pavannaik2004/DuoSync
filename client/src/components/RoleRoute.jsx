import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/useAuth';

function RoleGate({ role, children }) {
  const { user } = useAuth();
  if (!user || !user.roles.includes(role)) {
    return (
      <section className="page narrow">
        <h1>Admins only</h1>
        <p>This part of DuoSync is for admins. If you think you should have access, ask an admin.</p>
        <p className="actions"><Link className="btn" to="/dashboard">Back to the dashboard</Link></p>
      </section>
    );
  }
  return children;
}

RoleGate.propTypes = { role: PropTypes.oneOf(['admin', 'organizer']).isRequired, children: PropTypes.node.isRequired };

/**
 * ADMIN-1 on the client: a signed-in player holding `role`. Anyone else sees an explanation, not a redirect loop.
 * The server's 403 on every /api/admin route is the real guard; this only keeps the page honest.
 */
export default function RoleRoute({ role, children }) {
  return (
    <ProtectedRoute allow={['user']}>
      <RoleGate role={role}>{children}</RoleGate>
    </ProtectedRoute>
  );
}

RoleRoute.propTypes = { role: PropTypes.oneOf(['admin', 'organizer']).isRequired, children: PropTypes.node.isRequired };
