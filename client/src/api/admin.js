import { api } from './client';

/* The admin API (ADMIN-1..8). Every call needs an admin token; the server answers 403 otherwise. */
const enc = encodeURIComponent;

export function listThemes({ q = '', status = '' } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  const query = params.toString();
  return api(`/admin/themes${query ? `?${query}` : ''}`);
}
export const getTheme = (id) => api(`/admin/themes/${enc(id)}`);
export const createTheme = (body) => api('/admin/themes', { method: 'POST', body });
export const updateTheme = (id, body) => api(`/admin/themes/${enc(id)}`, { method: 'PUT', body });
export const deleteTheme = (id) => api(`/admin/themes/${enc(id)}`, { method: 'DELETE' });
export const createLevel = (themeId, body) => api(`/admin/themes/${enc(themeId)}/levels`, { method: 'POST', body });
export const updateLevel = (id, body) => api(`/admin/levels/${enc(id)}`, { method: 'PUT', body });
export const deleteLevel = (id) => api(`/admin/levels/${enc(id)}`, { method: 'DELETE' });
export const reorderLevels = (themeId, levelIds) =>
  api(`/admin/themes/${enc(themeId)}/levels/order`, { method: 'PATCH', body: { levelIds } });
export const previewTheme = (id, seed) =>
  api(`/admin/themes/${enc(id)}/preview`, { method: 'POST', body: seed ? { seed } : {} });
export const getCatalog = () => api('/admin/catalog');
export const searchUsers = (q) => api(`/admin/users?q=${enc(q)}`);
export const setOrganizer = (id, on) => api(`/admin/users/${enc(id)}/roles`, { method: 'PATCH', body: { organizer: on } });

/** The editable theme fields a PUT carries (D86: never the slug). */
export const THEME_FIELDS = ['name', 'genre', 'story', 'roles', 'timerMinutes', 'styleKey', 'boardLabel', 'revealText', 'failText', 'pools'];
export const themeBody = (theme, patch = {}) => ({
  ...Object.fromEntries(THEME_FIELDS.map((k) => [k, theme[k]])),
  active: theme.active,
  ...patch,
});

/** The editable level fields a POST or PUT carries (D87: never the order). */
export const LEVEL_FIELDS = ['title', 'mechanic', 'params', 'hint', 'rewardRule', 'timeEstimateSec', 'fallback'];
export const levelBody = (level) => Object.fromEntries(LEVEL_FIELDS.map((k) => [k, level[k] ?? null]));
