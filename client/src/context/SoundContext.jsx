import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { playCue, unlockAudio } from '../audio/sounds';
import { SoundContext } from './useSound';

const KEY = 'duosync:muted';

function readMuted() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * AUDIO-2 (D98): a mute flag remembered on the device, sound on until the player chooses.
 * Nothing plays before the first pointer or key press, which is when the audio is unlocked.
 */
export function SoundProvider({ children }) {
  const [muted, setMuted] = useState(readMuted);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((was) => {
      try {
        localStorage.setItem(KEY, was ? '0' : '1');
      } catch {
        // Private mode: the choice lasts for this page only.
      }
      return !was;
    });
  }, []);

  const play = useCallback((name) => {
    if (!muted) playCue(name);
  }, [muted]);

  const value = useMemo(() => ({ muted, toggleMuted, play }), [muted, toggleMuted, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

SoundProvider.propTypes = { children: PropTypes.node.isRequired };
