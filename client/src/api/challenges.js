import { api } from './client';

export const createChallenge = (body) => api('/challenges', { method: 'POST', body });
export const getChallenge = (code) => api(`/challenges/${encodeURIComponent(code)}`);
export const updateChallenge = (id, patch) =>
  api(`/challenges/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
export const deleteChallenge = (id) => api(`/challenges/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const enterChallenge = (id, teamId) =>
  api(`/challenges/${encodeURIComponent(id)}/entries`, { method: 'POST', body: { teamId } });
