import { createContext, useContext } from 'react';

export const SoundContext = createContext(null);

/** { muted, toggleMuted(), play(cueName) } — see SoundProvider. */
export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used inside <SoundProvider>');
  return ctx;
}
