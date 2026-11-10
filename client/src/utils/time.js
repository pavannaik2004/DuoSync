/* Challenge times (NFR-18): the server speaks ISO-8601 UTC, people read local time. */

const pad = (n) => String(n).padStart(2, '0');

/** A `datetime-local` value ("2026-11-10T14:30", local time) → an ISO-8601 UTC string. */
export function toUtcIso(datetimeLocalValue) {
  const date = new Date(datetimeLocalValue);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** An ISO string → the `datetime-local` value for the same moment in local time. */
export function toLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An ISO string → a readable local date and time, like "Tue, 10 Nov, 14:30". */
export function formatLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Milliseconds → "2d 3h 4m 5s", leaving out leading zero units. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (d || h) parts.push(`${h}h`);
  if (d || h || m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

const MIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PAST_GRACE_MS = 5 * 60 * 1000;

/**
 * The server's window rules (CHAL-1) on two `datetime-local` values:
 * at least 15 minutes, at most 30 days, and not in the past.
 * Returns [field, message] for the first problem, or null.
 */
export function windowProblem(startsAt, endsAt, { checkStart = true } = {}) {
  const start = new Date(toUtcIso(startsAt)).getTime();
  const end = new Date(toUtcIso(endsAt)).getTime();
  if (checkStart && start < Date.now() - PAST_GRACE_MS) return ['startsAt', 'The start time cannot be in the past.'];
  if (end - start < MIN_WINDOW_MS) return ['endsAt', 'The challenge must run for at least 15 minutes.'];
  if (end - start > MAX_WINDOW_MS) return ['endsAt', 'The challenge can run for at most 30 days.'];
  return null;
}
