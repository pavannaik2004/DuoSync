import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { validators } from '../utils/validators';
import { useAuth } from '../context/useAuth';

export default function Dashboard() {
  const { status, user, guest } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ code: '' }, { code: validators.challengeCode });
  const onOpen = form.handleSubmit(async ({ code }) => {
    navigate(`/challenge/${code.trim().toUpperCase()}`);
  });

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
        <Link className="tile tile-b" to="/challenges/new">
          <h2>Create a challenge</h2>
          <p>Pick a story and a time window, then share the code.</p>
        </Link>
        <div className="tile tile-a">
          <h2>Open a challenge</h2>
          <form className="form" onSubmit={onOpen} noValidate>
            {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
            <FormField
              label="Challenge code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              className="code-input"
              {...form.bind('code')}
            />
            <button type="submit" className="btn">Open challenge</button>
          </form>
        </div>
      </div>
    </section>
  );
}
