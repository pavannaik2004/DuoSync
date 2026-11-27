/**
 * AUDIO-1 sound effects, synthesized with the Web Audio API (no audio files, D97). One
 * AudioContext, created on the first pointer or key press (AUDIO-2: browsers block sound
 * before a gesture). Every cue is short (≤ 1.2 s) and quiet (gain ≤ 0.2).
 */
let ctx = null;

/** Creates or resumes the AudioContext. Call from a user gesture. */
export function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!ctx) {
    ctx = new AudioCtx();
    if (import.meta.env.DEV) window.__duosyncAudio = ctx;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** One note: `type` wave at `freq` Hz (or a glide to `to`), starting `at` s from now, lasting `dur` s. */
function note({ freq, to = freq, at = 0, dur = 0.15, type = 'sine', gain = 0.15, filter = null }) {
  const t0 = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let out = osc;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    osc.connect(lp);
    out = lp;
  }
  out.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const CUES = {
  correct: () => { note({ freq: 523, dur: 0.14 }); note({ freq: 784, at: 0.12, dur: 0.25 }); },
  wrong: () => note({ freq: 220, to: 140, dur: 0.35, type: 'sawtooth', gain: 0.12, filter: 900 }),
  unlock: () => [392, 523, 659].forEach((freq, i) => note({ freq, at: i * 0.07, dur: 0.16, type: 'triangle', gain: 0.12 })),
  hint: () => { note({ freq: 880, dur: 0.4, gain: 0.1 }); note({ freq: 1320, at: 0.18, dur: 0.5, gain: 0.07 }); },
  warning: () => { note({ freq: 1000, dur: 0.1, type: 'square', gain: 0.06, filter: 2500 }); note({ freq: 1000, at: 0.18, dur: 0.1, type: 'square', gain: 0.06, filter: 2500 }); },
  finish: () => [523, 659, 784, 1047].forEach((freq, i) => note({ freq, at: i * 0.12, dur: i === 3 ? 0.6 : 0.18, type: 'triangle', gain: 0.14 })),
  timeout: () => [392, 330, 262].forEach((freq, i) => note({ freq, at: i * 0.28, dur: 0.4, type: 'sawtooth', gain: 0.08, filter: 1200 })),
};

export const CUE_NAMES = Object.keys(CUES);

/** Plays a cue; does nothing before unlockAudio() or where Web Audio is missing. */
export function playCue(name) {
  if (import.meta.env.DEV) (window.__duosyncCues = window.__duosyncCues || []).push(name);
  if (!ctx || ctx.state !== 'running' || !CUES[name]) return;
  CUES[name]();
}
