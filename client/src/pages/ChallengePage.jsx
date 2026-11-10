import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmButton from '../components/ConfirmButton';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import useAsync from '../hooks/useAsync';
import useForm from '../hooks/useForm';
import useNow from '../hooks/useNow';
import { ApiError } from '../api/client';
import { deleteChallenge, enterChallenge, getChallenge, updateChallenge } from '../api/challenges';
import { myTeams } from '../api/teams';
import { patterns, validators } from '../utils/validators';
import { formatCountdown, formatLocal, toLocalInput, toUtcIso, windowProblem } from '../utils/time';
import challengeMessage from '../utils/challengeErrors';

const STATUS_TEXT = {
  upcoming: 'Not open yet',
  open: 'Open now',
  closing: 'Closed to new games; running games can finish',
  closed: 'Closed',
};

const challengeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  code: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  startsAt: PropTypes.string.isRequired,
  endsAt: PropTypes.string.isRequired,
  status: PropTypes.string.isRequired,
  teamsEntered: PropTypes.number.isRequired,
  maxTeams: PropTypes.number,
  isCreator: PropTypes.bool.isRequired,
});

function Countdown({ challenge }) {
  const now = useNow();
  const start = new Date(challenge.startsAt).getTime();
  const end = new Date(challenge.endsAt).getTime();
  if (now < start) return <p className="challenge-countdown">Opens in <strong>{formatCountdown(start - now)}</strong></p>;
  if (now < end) return <p className="challenge-countdown">Closes in <strong>{formatCountdown(end - now)}</strong></p>;
  return <p className="challenge-countdown">This challenge has closed.</p>;
}

Countdown.propTypes = { challenge: challengeShape.isRequired };

function ShareBox({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/challenge/${code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false); // the link is shown, so it can be copied by hand
    }
  }
  return (
    <div className="share-box">
      <p>Code: <strong className="code-display">{code}</strong></p>
      <p>Link: <span className="share-link">{link}</span></p>
      <button type="button" className="btn" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
    </div>
  );
}

ShareBox.propTypes = { code: PropTypes.string.isRequired };

function EnterForm({ challenge, onEntered }) {
  const teams = useAsync(() => myTeams(), []);
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (teams.loading) return <StatusMessage kind="loading" message="Loading your teams…" />;
  if (teams.error) {
    return (
      <StatusMessage
        kind="error"
        message={teams.error.message}
        action={<button type="button" className="btn" onClick={teams.reload}>Try again</button>}
      />
    );
  }
  const full = teams.data.teams.filter((t) => t.members.length === 2 && !t.archived);
  if (full.length === 0) {
    return (
      <StatusMessage
        kind="empty"
        message="To enter, you need a team with 2 members. Start a team and invite your partner."
        action={<Link className="btn btn-primary" to="/teams">Go to my teams</Link>}
      />
    );
  }
  const chosen = full.find((t) => t.id === teamId) || full[0];

  async function enter(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await enterChallenge(challenge.id, chosen.id);
      await onEntered();
    } catch (err) {
      setError(challengeMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={enter}>
      <h2 className="section-title">Enter with a team</h2>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="field">
        <label htmlFor="enter-team">Team</label>
        <select id="enter-team" value={chosen.id} onChange={(e) => setTeamId(e.target.value)}>
          {full.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Entering…' : 'Enter this challenge'}</button>
    </form>
  );
}

EnterForm.propTypes = { challenge: challengeShape.isRequired, onEntered: PropTypes.func.isRequired };

/** The creator can change the name, window and team limit until the challenge starts (D61). */
function EditForm({ challenge, onSaved }) {
  const form = useForm(
    {
      name: challenge.name,
      startsAt: toLocalInput(challenge.startsAt),
      endsAt: toLocalInput(challenge.endsAt),
      maxTeams: challenge.maxTeams === null ? '' : String(challenge.maxTeams),
    },
    {
      name: validators.challengeName,
      startsAt: (v) => (v ? '' : 'Choose when the challenge opens.'),
      endsAt: (v) => (v ? '' : 'Choose when the challenge closes.'),
      maxTeams: (v) => {
        const t = (v ?? '').trim();
        if (!t) return '';
        const n = Number(t);
        return Number.isInteger(n) && n >= 2 && n <= 500 ? '' : 'Use a whole number from 2 to 500, or leave it empty.';
      },
    },
  );

  const save = form.handleSubmit(async (values) => {
    const startChanged = toUtcIso(values.startsAt) !== challenge.startsAt && values.startsAt !== toLocalInput(challenge.startsAt);
    const bad = windowProblem(values.startsAt, values.endsAt, { checkStart: startChanged });
    if (bad) throw new ApiError(0, 'VALIDATION_ERROR', bad[1], [{ field: bad[0], message: bad[1] }]);
    const patch = { name: values.name.trim() };
    if (startChanged) patch.startsAt = toUtcIso(values.startsAt);
    if (values.endsAt !== toLocalInput(challenge.endsAt)) patch.endsAt = toUtcIso(values.endsAt);
    patch.maxTeams = values.maxTeams.trim() ? Number(values.maxTeams) : null;
    try {
      await updateChallenge(challenge.id, patch);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') throw err;
      throw new ApiError(err.status, err.code, challengeMessage(err), err.details);
    }
    await onSaved();
  });

  return (
    <form className="form" onSubmit={save} noValidate>
      <h2 className="section-title">Change this challenge</h2>
      {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
      <FormField label="Challenge name" autoComplete="off" {...form.bind('name')} />
      <FormField label="Opens" type="datetime-local" {...form.bind('startsAt')} />
      <FormField label="Closes" type="datetime-local" {...form.bind('endsAt')} />
      <FormField label="Team limit (optional)" type="number" inputMode="numeric" min="2" max="500" {...form.bind('maxTeams')} />
      <button type="submit" className="btn" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

EditForm.propTypes = { challenge: challengeShape.isRequired, onSaved: PropTypes.func.isRequired };

function ChallengeDetails({ challenge, reload }) {
  const navigate = useNavigate();
  const now = useNow();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const start = new Date(challenge.startsAt).getTime();
  const open = challenge.status === 'upcoming' || challenge.status === 'open';
  const { myEntry } = challenge;

  async function remove() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteChallenge(challenge.id);
      navigate('/dashboard');
    } catch (err) {
      setDeleteError(challengeMessage(err));
      setDeleting(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <h1>{challenge.name}</h1>
        <span className="badge">{STATUS_TEXT[challenge.status]}</span>
      </div>
      <p><strong>{challenge.theme.name}</strong> · {challenge.theme.genre} · {challenge.theme.timerMinutes} min per game</p>
      <p>{challenge.theme.story}</p>
      <p>
        Opens <strong>{formatLocal(challenge.startsAt)}</strong><br />
        Closes <strong>{formatLocal(challenge.endsAt)}</strong>
      </p>
      <Countdown challenge={challenge} />
      <p>
        Teams entered: <strong>{challenge.teamsEntered}</strong>
        {challenge.maxTeams !== null && <> of {challenge.maxTeams}</>}
      </p>
      <ShareBox code={challenge.code} />

      {myEntry && (
        <div className="actions">
          <p>
            Your team <strong>{myEntry.teamName}</strong> has entered.
          </p>
          <Link className="btn btn-primary" to={`/challenge/${challenge.code}/play`}>Open team lobby</Link>
        </div>
      )}
      {!myEntry && open && <EnterForm challenge={challenge} onEntered={reload} />}
      {!myEntry && !open && <p className="form-note">Entries are closed.</p>}

      {challenge.isCreator && now < start && (
        <>
          <EditForm challenge={challenge} onSaved={reload} />
          <h2 className="section-title">Delete this challenge</h2>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <ConfirmButton label="Delete challenge" confirmLabel="Yes, delete it" onConfirm={remove} busy={deleting} danger />
        </>
      )}
    </section>
  );
}

ChallengeDetails.propTypes = {
  challenge: challengeShape.isRequired,
  reload: PropTypes.func.isRequired,
};

/** /challenge/:code — the details, the share link, and entering or opening the team lobby. */
export default function ChallengePage() {
  const { code = '' } = useParams();
  const valid = patterns.CHALLENGE_CODE.test(code);
  const challenge = useAsync(() => (valid ? getChallenge(code.toUpperCase()) : Promise.resolve(null)), [code]);
  const back = <Link className="btn" to="/dashboard">Back to the dashboard</Link>;

  if (!valid) {
    return <StatusMessage kind="error" message="That challenge code doesn't look right. Codes have 6 letters and digits." action={back} />;
  }
  if (challenge.loading) return <StatusMessage kind="loading" message="Loading the challenge…" />;
  if (challenge.error) {
    return <StatusMessage kind="error" message={challengeMessage(challenge.error)} action={back} />;
  }
  return <ChallengeDetails challenge={challenge.data} reload={challenge.reload} />;
}
