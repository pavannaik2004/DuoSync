import { Link, Navigate, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/useAuth';
import { enterAsGuest } from '../api/auth';
import { validators } from '../utils/validators';

export default function GuestEntry() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ nickname: '' }, { nickname: validators.nickname });

  if (status === 'user' || status === 'guest') return <Navigate to="/dashboard" replace />;

  const onSubmit = form.handleSubmit(async ({ nickname }) => {
    login(await enterAsGuest(nickname.trim()));
    navigate('/dashboard', { replace: true });
  });

  return (
    <section className="page narrow">
      <h1>Play as a guest</h1>
      <p>Guests can play practice games for 24 hours. Teams, challenges and leaderboards need an account.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField label="Nickname" autoComplete="nickname" hint="3-20 letters, digits or underscores." {...form.bind('nickname')} />
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>
          {form.submitting ? 'Starting…' : 'Continue as guest'}
        </button>
      </form>
      <p className="form-note">Want to keep your results? <Link to="/signup">Create an account</Link></p>
    </section>
  );
}
