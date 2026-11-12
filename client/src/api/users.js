import { api } from './client';

export const getProfile = () => api('/users/me');
export const myHistory = (page = 1) => api(`/users/me/history?page=${encodeURIComponent(page)}`);
