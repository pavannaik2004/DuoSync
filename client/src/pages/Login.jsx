import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/useAuth';
import { login as loginRequest } from '../api/auth';
import { validators } from '../utils/validators';
import safeNext from '../utils/safeNext';

export default function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const form = useForm({ email: '', password: '' }, { email: validators.email, password: validators.loginPassword });

  if (status === 'user') return <Navigate to={safeNext(next)} replace />;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    login(await loginRequest({ email: email.trim(), password }));
    navigate(safeNext(next), { replace: true });
  });

  const signupLink = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';

  return (
    <section className="page narrow">
      <h1>Log in</h1>
      {next && <p className="form-note">Log in to continue to that page.</p>}
      <form className="form" onSubmit={onSubmit} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField label="Email" type="email" autoComplete="email" {...form.bind('email')} />
        <FormField label="Password" type="password" autoComplete="current-password" {...form.bind('password')} />
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>
          {form.submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="form-note">New here? <Link to={signupLink}>Create an account</Link></p>
    </section>
  );
}
