import { api } from './client';

/** PRAC-1: opens a practice room; returns { code }. */
export const createPractice = () => api('/practice', { method: 'POST' });

/** Room preview: theme, players and whether it is full. */
export const getPractice = (code) => api(`/practice/${encodeURIComponent(code)}`);
