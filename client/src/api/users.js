import { api } from './client';

export const getProfile = () => api('/users/me');
/** AUTH-7: { username?, avatarColor? } → the updated profile. */
export const updateProfile = (changes) => api('/users/me', { method: 'PATCH', body: changes });
export const myHistory = (page = 1) => api(`/users/me/history?page=${encodeURIComponent(page)}`);
