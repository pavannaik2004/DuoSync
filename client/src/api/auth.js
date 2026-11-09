import { api } from './client';

export const signup = (fields) => api('/auth/signup', { method: 'POST', body: fields });
export const login = (fields) => api('/auth/login', { method: 'POST', body: fields });
export const enterAsGuest = (nickname) => api('/auth/guest', { method: 'POST', body: { nickname } });
export const me = () => api('/auth/me');
