import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import ConfirmButton from '../components/ConfirmButton';
import FormField from '../components/FormField';
import StatusMessage from '../components/StatusMessage';
import { memberShape, teamShape } from '../components/shapes';
import useAsync from '../hooks/useAsync';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/useAuth';
import { getTeam, newInviteCode, removeMember, renameTeam } from '../api/teams';
import { splitApiError } from '../utils/formErrors';
import { validators } from '../utils/validators';

function MemberList({ members, captainId, archived }) {
  return (
    <ul className="member-list">
      {members.map((m) => (
        <li key={m.id}>
          <span className="avatar" style={{ background: m.avatarColor }} aria-hidden="true">
            {m.username.slice(0, 1).toUpperCase()}
          </span>
          <span>{m.username}</span>
          {m.id === captainId && <span className="badge">Captain</span>}
        </li>
      ))}
      {!archived && members.length < 2 && (
        <li className="seat-open">
          <span className="avatar avatar-empty" aria-hidden="true">?</span>
          <span>Open seat: send the invite link below</span>
        </li>
      )}
    </ul>
  );
}

MemberList.propTypes = {
  members: PropTypes.arrayOf(memberShape).isRequired,
  captainId: PropTypes.string.isRequired,
  archived: PropTypes.bool.isRequired,
};

function InviteBox({ code }) {
  const [copied, setCopied] = useState('');
  const link = `${window.location.origin}/teams/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Link copied.');
    } catch {
      document.getElementById('invite-link')?.select();
      setCopied('Press Ctrl+C (or long-press) to copy the selected link.');
    }
  }

  return (
    <div className="invite">
      <p className="invite-code" aria-label={`Invite code ${code.split('').join(' ')}`}>{code}</p>
      <label htmlFor="invite-link" className="field-hint">Invite link</label>
      <div className="invite-row">
        <input id="invite-link" readOnly value={link} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn" onClick={copy}>Copy link</button>
      </div>
      <p className="form-note" role="status">{copied}</p>
    </div>
  );
}

InviteBox.propTypes = { code: PropTypes.string.isRequired };

function RenameForm({ team, onRenamed }) {
  const form = useForm({ name: team.name }, { name: validators.teamName });
  const onSubmit = form.handleSubmit(async ({ name }) => onRenamed(await renameTeam(team.id, name.trim())));
  return (
    <form className="form inline-form" onSubmit={onSubmit} noValidate>
      {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
      <FormField label="Team name" autoComplete="off" {...form.bind('name')} />
      <button type="submit" className="btn" disabled={form.submitting || form.values.name.trim() === team.name}>
        {form.submitting ? 'Saving…' : 'Rename team'}
      </button>
    </form>
  );
}

RenameForm.propTypes = { team: teamShape.isRequired, onRenamed: PropTypes.func.isRequired };

export default function TeamPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const team = useAsync(() => getTeam(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function run(action) {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (err) {
      setActionError(splitApiError(err).form || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (team.loading) return <StatusMessage kind="loading" message="Loading team…" />;
  if (team.error) {
    const missing = team.error.code === 'TEAM_NOT_FOUND';
    return (
      <StatusMessage
        kind="error"
        message={missing ? 'This team does not exist.' : team.error.message}
        action={missing
          ? <Link className="btn" to="/teams">Back to my teams</Link>
          : <button type="button" className="btn" onClick={team.reload}>Try again</button>}
      />
    );
  }

  const t = team.data;
  const isMember = t.members.some((m) => m.id === user.id);
  const partner = t.members.find((m) => m.id !== user.id);

  return (
    <section className="page">
      <p className="crumb"><Link to="/teams">My teams</Link></p>
      <h1>{t.name}</h1>
      {t.archived && <p className="form-note">This team is archived. Its past results are kept.</p>}

      <MemberList members={t.members} captainId={t.captainId} archived={t.archived} />

      {isMember && t.inviteCode && t.members.length < 2 && (
        <>
          <h2 className="section-title">Invite your partner</h2>
          <InviteBox code={t.inviteCode} />
        </>
      )}

      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      {isMember && t.isCaptain && (
        <>
          <h2 className="section-title">Captain tools</h2>
          <RenameForm key={t.name} team={t} onRenamed={team.setData} />
          <div className="actions">
            <ConfirmButton
              label="Make a new invite code"
              confirmLabel="Yes, replace the code"
              busy={busy}
              onConfirm={() => run(async () => {
                const { inviteCode } = await newInviteCode(t.id);
                team.setData((d) => ({ ...d, inviteCode }));
              })}
            />
            {partner && (
              <ConfirmButton
                label={`Remove ${partner.username}`}
                confirmLabel={`Yes, remove ${partner.username}`}
                danger
                busy={busy}
                onConfirm={() => run(async () => {
                  await removeMember(t.id, partner.id);
                  team.reload();
                })}
              />
            )}
          </div>
          <p className="form-note">A new code stops the old link from working.</p>
        </>
      )}

      {isMember && (
        <div className="actions leave">
          <ConfirmButton
            label="Leave team"
            confirmLabel={t.members.length === 1 ? 'Yes, leave and archive the team' : 'Yes, leave'}
            danger
            busy={busy}
            onConfirm={() => run(async () => {
              await removeMember(t.id, user.id);
              navigate('/teams', { replace: true });
            })}
          />
        </div>
      )}
    </section>
  );
}
