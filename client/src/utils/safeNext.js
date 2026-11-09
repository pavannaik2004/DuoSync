const FALLBACK = '/dashboard';
// Browsers drop tabs and newlines inside URLs, so "/\t/evil.com" becomes "//evil.com".
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\\]/;

/**
 * Where to go after logging in. Only paths on this site are allowed, so a crafted
 * link like /login?next=//evil.com cannot send people off-site (DECISIONS D19).
 * The value is resolved the way the browser would resolve it and must stay same-origin.
 */
export default function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || UNSAFE_CHARS.test(next)) return FALLBACK;
  let url;
  try {
    url = new URL(next, window.location.origin);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== window.location.origin) return FALLBACK;
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/signup')) return FALLBACK;
  return url.pathname + url.search + url.hash;
}
