import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Landing() {
  const { status } = useAuth();
  if (status === 'user' || status === 'guest') return <Navigate to="/dashboard" replace />;

  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="split-mark" aria-label="DuoSync">
          <span className="half half-a" aria-hidden="true">Duo</span>
          <span className="half half-b" aria-hidden="true">Sync</span>
        </h1>
        <p className="hero-line">
          An escape room for two. You each see half of every clue, so you only get out by talking it through.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/signup">Create an account</Link>
          <Link className="btn" to="/guest">Try practice as a guest</Link>
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How a run works</h2>
        <ol className="steps">
          <li>
            <h3>Pair up</h3>
            <p>Create a team and send your partner the invite link.</p>
          </li>
          <li>
            <h3>Split the clue</h3>
            <p>Each of you sees a different half of every level. Describe yours in team chat.</p>
          </li>
          <li>
            <h3>Answer together</h3>
            <p>Either of you submits. Five levels, one clock, and a leaderboard shared with every other team.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
