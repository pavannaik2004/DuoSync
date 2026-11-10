import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import useForm from '../hooks/useForm';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../context/useAuth';
import { ApiError } from '../api/client';
import { createChallenge } from '../api/challenges';
import { listThemes } from '../api/themes';
import { validators } from '../utils/validators';
import { toUtcIso, windowProblem } from '../utils/time';
import challengeMessage from '../utils/challengeErrors';

const required = (message) => (value) => (value ? '' : message);

function maxTeamsError(value) {
  const v = (value ?? '').trim();
  if (!v) return '';
  const n = Number(v);
  return Number.isInteger(n) && n >= 2 && n <= 500 ? '' : 'Use a whole number from 2 to 500, or leave it empty.';
}

/** CHAL-1: create a challenge. Organizers and admins can also make it public. */
export default function CreateChallenge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canBePublic = user.roles.includes('organizer') || user.roles.includes('admin');
  const themes = useAsync(listThemes, []);
  const [theme, setTheme] = useState('');
  const chosen = themes.data?.find((t) => t.slug === theme) || themes.data?.[0] || null;
  const form = useForm(
    { name: '', startsAt: '', endsAt: '', maxTeams: '', visibility: 'private' },
    {
      name: validators.challengeName,
      startsAt: required('Choose when the challenge opens.'),
      endsAt: required('Choose when the challenge closes.'),
      maxTeams: maxTeamsError,
    },
  );

  const onCreate = form.handleSubmit(async (values) => {
    const bad = windowProblem(values.startsAt, values.endsAt);
    if (bad) throw new ApiError(0, 'VALIDATION_ERROR', bad[1], [{ field: bad[0], message: bad[1] }]);
    const body = {
      name: values.name.trim(),
      theme: chosen.slug,
      startsAt: toUtcIso(values.startsAt),
      endsAt: toUtcIso(values.endsAt),
      visibility: canBePublic ? values.visibility : 'private',
    };
    if (values.maxTeams.trim()) body.maxTeams = Number(values.maxTeams);
    try {
      const { code } = await createChallenge(body);
      navigate(`/challenge/${code}`);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') throw err;
      throw new ApiError(err.status, err.code, challengeMessage(err), err.details);
    }
  });

  return (
    <section className="page narrow">
      <h1>Create a challenge</h1>
      <p>Pick a story and a time window. Teams enter with a code or a link and play during the window.</p>
      {themes.loading && <StatusMessage kind="loading" message="Loading themes…" />}
      {themes.error && (
        <StatusMessage
          kind="error"
          message={themes.error.message}
          action={<button type="button" className="btn" onClick={themes.reload}>Try again</button>}
        />
      )}
      {chosen && (
        <form className="form" onSubmit={onCreate} noValidate>
          {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
          <FormField label="Challenge name" autoComplete="off" hint="3-40 letters, digits, spaces, _ ' ! ? or -." {...form.bind('name')} />
          <div className="field">
            <label htmlFor="challenge-theme">Theme</label>
            <select id="challenge-theme" value={chosen.slug} onChange={(e) => setTheme(e.target.value)}>
              {themes.data.map((t) => (
                <option key={t.slug} value={t.slug}>{`${t.name} · ${t.genre} · ${t.timerMinutes} min`}</option>
              ))}
            </select>
            <span className="field-hint">{chosen.story}</span>
          </div>
          <FormField
            label="Opens"
            type="datetime-local"
            hint="In your local time. Teams can enter before it opens."
            {...form.bind('startsAt')}
          />
          <FormField
            label="Closes"
            type="datetime-local"
            hint="At least 15 minutes after it opens, and at most 30 days."
            {...form.bind('endsAt')}
          />
          <FormField
            label="Team limit (optional)"
            type="number"
            inputMode="numeric"
            min="2"
            max="500"
            hint="Leave empty for no limit."
            {...form.bind('maxTeams')}
          />
          {canBePublic ? (
            <fieldset className="field radio-group">
              <legend>Who can find it</legend>
              {[['private', 'Private: only people with the code or link'], ['public', 'Public: listed for everyone']].map(([value, text]) => (
                <label key={value} className="radio-row">
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={form.values.visibility === value}
                    onChange={() => form.setValues((v) => ({ ...v, visibility: value }))}
                  />
                  <span>{text}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="form-note">This challenge will be private: only people with the code or link can enter.</p>
          )}
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={form.submitting}>
              {form.submitting ? 'Creating…' : 'Create challenge'}
            </button>
            <Link className="btn" to="/dashboard">Cancel</Link>
          </div>
        </form>
      )}
    </section>
  );
}
