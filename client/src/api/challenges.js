import { api } from './client';

/** CHAL-4: one page of public challenges. `status` all|upcoming|open|closed, `theme` a slug or '', `page` from 1. */
export function listChallenges({ status = 'all', theme = '', page = 1 } = {}) {
  const q = new URLSearchParams();
  if (status !== 'all') q.set('status', status);
  if (theme) q.set('theme', theme);
  if (page > 1) q.set('page', String(page));
  const query = q.toString();
  return api(`/challenges${query ? `?${query}` : ''}`);
}
export const createChallenge = (body) => api('/challenges', { method: 'POST', body });
export const getChallenge = (code) => api(`/challenges/${encodeURIComponent(code)}`);
export const updateChallenge = (id, patch) =>
  api(`/challenges/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
export const deleteChallenge = (id) => api(`/challenges/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getLeaderboard = (id) => api(`/challenges/${encodeURIComponent(id)}/leaderboard`);
export const getChallengeTeams = (id) => api(`/challenges/${encodeURIComponent(id)}/teams`);
export const getSolutions = (id) => api(`/challenges/${encodeURIComponent(id)}/solutions`);
export const enterChallenge = (id, teamId) =>
  api(`/challenges/${encodeURIComponent(id)}/entries`, { method: 'POST', body: { teamId } });
