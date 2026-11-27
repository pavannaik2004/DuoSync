import { useSound } from '../context/useSound';

/** AUDIO-2: the sound switch in the site header. Its text says the current state. */
export default function MuteToggle() {
  const { muted, toggleMuted } = useSound();
  return (
    <button type="button" className="btn btn-ghost mute-toggle" onClick={toggleMuted}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted
          ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </svg>
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  );
}
