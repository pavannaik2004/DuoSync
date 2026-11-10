import { api } from './client';

/** Lists the playable themes: [{ slug, name, genre, story, timerMinutes, styleKey, roles }]. */
export const listThemes = () => api('/themes');
