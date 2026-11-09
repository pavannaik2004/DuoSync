import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import TeamCard from '../components/TeamCard';
import useAsync from '../hooks/useAsync';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/useAuth';
import { createTeam, myTeams } from '../api/teams';
import { validators } from '../utils/validators';

export default function MyTeams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const teams = useAsync(() => myTeams(), []);
  const form = useForm({ name: '' }, { name: validators.teamName });

  const onCreate = form.handleSubmit(async ({ name }) => {
    const team = await createTeam(name.trim());
    navigate(`/teams/${team.id}`);
  });

  let list;
  if (teams.loading) list = <StatusMessage kind="loading" message="Loading your teams…" />;
  else if (teams.error) {
    list = (
      <StatusMessage
        kind="error"
        message={teams.error.message}
        action={<button type="button" className="btn" onClick={teams.reload}>Try again</button>}
      />
    );
  } else if (teams.data.teams.length === 0) {
    list = <StatusMessage kind="empty" message="You are not in a team yet. Start one below, or join a friend's team with their invite code." />;
  } else {
    list = (
      <ul className="team-list">
        {teams.data.teams.map((t) => <TeamCard key={t.id} team={t} viewerId={user.id} />)}
      </ul>
    );
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>My teams</h1>
        <Link className="btn" to="/teams/join">Join with a code</Link>
      </div>
      {list}

      <h2 className="section-title">Start a new team</h2>
      <p className="form-note">You become the captain and get an invite link to send your partner.</p>
      <form className="form" onSubmit={onCreate} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField label="Team name" autoComplete="off" hint="3-24 letters, digits, spaces, _ or -." {...form.bind('name')} />
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>
          {form.submitting ? 'Creating…' : 'Create team'}
        </button>
      </form>
    </section>
  );
}
