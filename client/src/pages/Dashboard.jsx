import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Dashboard() {
  const { status, user, guest } = useAuth();

  if (status === 'guest') {
    return (
      <section className="page narrow">
        <h1>Hi, {guest.nickname}</h1>
        <p>Practice rooms open in an upcoming update. To join a team and play ranked challenges, create an account.</p>
        <p><Link className="btn btn-primary" to="/signup">Create an account</Link></p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Hi, {user.username}</h1>
      <div className="tiles">
        <Link className="tile tile-a" to="/teams">
          <h2>My teams</h2>
          <p>See your teams, invite a partner, or start a new team.</p>
        </Link>
        <Link className="tile tile-b" to="/teams/join">
          <h2>Join a team</h2>
          <p>Got an invite code from a friend? Enter it here.</p>
        </Link>
      </div>
    </section>
  );
}
