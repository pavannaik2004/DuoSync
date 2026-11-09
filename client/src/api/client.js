const TOKEN_KEY = 'duosync.token';
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let onUnauthorized = () => {};

/** Lets AuthContext log out when the server rejects the token (AUTH-5). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Storage can be blocked (private mode, strict settings), so every access is guarded.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

/** A failed request. `code` is the server's error code; switch on it, not on `message`. */
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Calls `/api${path}` with the stored token. Returns parsed JSON, or null for 204. */
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new ApiError(
      res.status,
      data?.error || 'HTTP_ERROR',
      data?.message || `The server answered with status ${res.status}.`,
      data?.details || [],
    );
    if (err.code === 'AUTH_REQUIRED' && token) onUnauthorized();
    throw err;
  }
  return data;
}
