/**
 * AUDIO-1 cues from two attempt states (D99). Pure. A snapshot (join, start, reconnect)
 * never plays anything, so a refresh or a reconnect cannot replay old cues.
 */
const WARNINGS = [300000, 60000, 10000]; // TIME-2

export function cuesFor(prev, next) {
  if (!prev || !next || prev.snapshotSeq !== next.snapshotSeq) return [];
  const cues = [];

  const prevSeq = prev.lastResult ? prev.lastResult.seq : 0;
  if (next.lastResult && next.lastResult.seq > prevSeq) cues.push(next.lastResult.correct ? 'correct' : 'wrong');

  if (next.clue && next.clue.order > 1 && (!prev.clue || next.clue.order > prev.clue.order)) cues.push('unlock');

  if (next.clue && prev.clue && next.clue.order === prev.clue.order && next.clue.hint?.ready && !prev.clue.hint?.ready) cues.push('hint');

  const before = prev.remainingMs;
  const now = next.remainingMs;
  if (next.status === 'in_progress' && before != null && now != null && WARNINGS.some((t) => before > t && now <= t)) cues.push('warning');

  if (prev.status !== next.status) {
    if (next.status === 'finished') cues.push('finish');
    if (next.status === 'timed_out') cues.push('timeout');
  }
  return cues;
}
