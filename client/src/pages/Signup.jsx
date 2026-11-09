import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/useAuth';
import { signup as signupRequest } from '../api/auth';
import { validators } from '../utils/validators';
import safeNext from '../utils/safeNext';

export default function Signup() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const form = useForm(
    { username: '', email: '', password: '' },
    { username: validators.username, email: validators.email, password: validators.password },
  );

  if (status === 'user') return <Navigate to={safeNext(next)} replace />;

  const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
    login(await signupRequest({ username: username.trim(), email: email.trim(), password }));
    navigate(safeNext(next), { replace: true });
  });

  const loginLink = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <section className="page narrow">
      <h1>Create an account</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField
          label="Username"
          autoComplete="username"
          hint="3-20 letters, digits or underscores. Your teammates see this."
          {...form.bind('username')}
        />
        <FormField label="Email" type="email" autoComplete="email" {...form.bind('email')} />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a digit."
          {...form.bind('password')}
        />
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>
          {form.submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="form-note">Already have an account? <Link to={loginLink}>Log in</Link></p>
    </section>
  );
}
