import { Link, useNavigate, useParams } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { joinTeam } from '../api/teams';
import { validators } from '../utils/validators';

/** TEAM-2: /teams/join/:code comes from an invite link; /teams/join is typed by hand. */
export default function JoinTeam() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const form = useForm({ code }, { code: validators.inviteCode });

  const onSubmit = form.handleSubmit(async (values) => {
    const team = await joinTeam(values.code.trim());
    navigate(`/teams/${team.id}`, { replace: true });
  });

  return (
    <section className="page narrow">
      <h1>Join a team</h1>
      <p>{code ? 'You were invited to a team. Join to become its second player.' : 'Enter the invite code your partner sent you.'}</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField
          label="Invite code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          className="code-input"
          {...form.bind('code')}
        />
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>
          {form.submitting ? 'Joining…' : 'Join team'}
        </button>
      </form>
      <p className="form-note"><Link to="/teams">Back to my teams</Link></p>
    </section>
  );
}
