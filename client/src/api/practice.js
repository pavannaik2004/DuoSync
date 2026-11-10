import { api } from './client';

/** PRAC-1: opens a practice room; returns { code }. */
export const createPractice = () => api('/practice', { method: 'POST' });
