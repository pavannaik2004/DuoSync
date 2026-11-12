import { api } from './client';

export const getResult = (attemptId) => api(`/attempts/${encodeURIComponent(attemptId)}/result`);
