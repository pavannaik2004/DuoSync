/**
 * Where to go after logging in. Only same-site paths are allowed, so a crafted
 * link like /login?next=//evil.com cannot send people off-site (DECISIONS D19).
 */
export default function safeNext(next) {
  if (typeof next !== 'string') return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/dashboard';
  if (next.startsWith('/login') || next.startsWith('/signup')) return '/dashboard';
  return next;
}
