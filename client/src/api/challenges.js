import { api } from './client';

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
