import { api } from './client';

/** PRAC-1: opens a practice room for a theme slug; returns { code }. */
export const createPractice = (theme) => api('/practice', { method: 'POST', body: { theme } });
