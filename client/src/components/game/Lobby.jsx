import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import RoleCard from './RoleCard';
import ChatPanel from './ChatPanel';
import { attemptShape, gameActionsShape } from './gameShapes';

/** Seconds left in the lobby countdown, from the server's countdownEndsAt. */
function useSecondsUntil(iso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [iso]);
  if (!iso) return null;
  return Math.min(5, Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)));
}

function InviteBox({ code }) {
  const [note, setNote] = useState('');
  const link = `${window.location.origin}/play/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setNote('Link copied.');
    } catch {
      document.getElementById('room-link')?.select();
      setNote('Press Ctrl+C (or long-press) to copy the selected link.');
    }
  }

  return (
    <div className="invite">
      <p>Send this to your teammate. They join with the code or the link.</p>
      <p className="invite-code" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</p>
      <div className="invite-row">
        <input id="room-link" readOnly value={link} aria-label="Room link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn" onClick={copy}>Copy link</button>
      </div>
      <p className="form-note" role="status">{note}</p>
    </div>
  );
}

InviteBox.propTypes = { code: PropTypes.string.isRequired };

/**
 * Team lobby (LOBBY-1..5): roles, presence, ready state, the 5-second countdown,
 * the one-attempt warning and team chat.
 */
export default function Lobby({ state, actions }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seconds = useSecondsUntil(state.status === 'countdown' ? state.countdownEndsAt : null);
  const { theme, players, me } = state;
  const mine = players.find((p) => p.id === me.id);
  const partner = players.find((p) => p.id !== me.id);
  const holderOf = (letter) => players.find((p) => p.role === letter) || null;

  async function run(action) {
    setBusy(true);
    const ack = await action();
    setBusy(false);
    setError(ack.error ? ack.message : '');
  }

  let readyHint = 'Pick a role, then press Ready.';
  if (mine?.role && !partner) readyHint = 'Waiting for your teammate to join.';
  else if (mine?.role && !partner.connected) readyHint = `${partner.name} is offline.`;
  else if (mine?.ready && !partner.ready) readyHint = `Waiting for ${partner.name} to get ready.`;
  else if (mine?.role && !mine.ready) readyHint = 'Press Ready when you are set.';

  return (
    <div className="lobby">
      <section className="lobby-main">
        <header className="lobby-head">
          <p className="lobby-kicker">{state.practiceCode ? `Practice room ${state.practiceCode}` : 'Challenge lobby'}</p>
          <h1>{theme.name}</h1>
          <p className="lobby-story">{theme.story}</p>
        </header>

        {players.length < 2 && state.practiceCode && <InviteBox code={state.practiceCode} />}
        {players.length < 2 && !state.practiceCode && (
          <p className="form-note">Your team needs 2 members to start. Ask your captain to invite a new partner.</p>
        )}

        <h2 className="visually-hidden">Roles</h2>
        <div className="role-grid">
          {['A', 'B'].map((letter) => (
            <RoleCard
              key={letter}
              letter={letter}
              role={theme.roles[letter]}
              holder={holderOf(letter)}
              isMine={mine?.role === letter}
              canClaim={state.status === 'lobby'}
              busy={busy || state.status !== 'lobby'}
              onClaim={() => run(() => actions.claimRole(letter))}
              onRelease={() => run(actions.releaseRole)}
            />
          ))}
        </div>

        {state.status === 'countdown' ? (
          <div className="countdown" role="status">
            <p className="countdown-number" aria-live="assertive">{seconds}</p>
            <p>Starting… Either of you can still cancel.</p>
            <button type="button" className="btn btn-danger" onClick={() => run(actions.cancel)} disabled={busy}>Cancel</button>
          </div>
        ) : (
          <div className="ready-bar">
            {mine?.ready ? (
              <button type="button" className="btn" onClick={() => run(actions.cancel)} disabled={busy}>Not ready</button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => run(actions.ready)} disabled={busy || !mine?.role}>
                Ready
              </button>
            )}
            <p className="form-note" role="status">{readyHint}</p>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="lobby-rules">
          <p className="warning"><strong>You get one attempt.</strong> Leaving the page does not stop the timer.</p>
          <ul>
            <li>Timer: {theme.timerMinutes} minutes for 5 levels.</li>
            <li>Each level is worth up to 100 points. The first minute on a level is free; after that, points drop slowly.</li>
            <li>A wrong answer costs 10 points. Finishing early adds a time bonus.</li>
          </ul>
        </div>
      </section>

      <aside className="lobby-chat">
        <h2>Team chat</h2>
        <ChatPanel messages={state.chat} roles={theme.roles} onSend={actions.sendChat} />
      </aside>
    </div>
  );
}

Lobby.propTypes = {
  state: attemptShape.isRequired,
  actions: gameActionsShape.isRequired,
};
