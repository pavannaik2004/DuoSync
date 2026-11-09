import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Dashboard() {
  const { status, user, guest } = useAuth();

  if (status === 'guest') {
    return (
      <section className="page narrow">
        <h1>Hi, {guest.nickname}</h1>
        <p>Guests can play practice games with any partner. To join a team and play ranked challenges, create an account.</p>
        <p className="actions">
          <Link className="btn btn-primary" to="/practice">Start a practice room</Link>
          <Link className="btn" to="/signup">Create an account</Link>
        </p>
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
        <Link className="tile tile-a" to="/practice">
          <h2>Practice</h2>
          <p>Play Cyber Heist with any partner. Not ranked.</p>
        </Link>
      </div>
    </section>
  );
}
