import { api } from './client';

export const createTeam = (name) => api('/teams', { method: 'POST', body: { name } });
export const myTeams = () => api('/teams/mine');
export const getTeam = (id) => api(`/teams/${encodeURIComponent(id)}`);
export const teamHistory = (id, page = 1) => api(`/teams/${encodeURIComponent(id)}/history?page=${encodeURIComponent(page)}`);
export const joinTeam = (code) => api('/teams/join', { method: 'POST', body: { code } });
export const renameTeam = (id, name) => api(`/teams/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } });
export const newInviteCode = (id) => api(`/teams/${encodeURIComponent(id)}/invite-code`, { method: 'POST' });
export const removeMember = (id, userId) =>
  api(`/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
