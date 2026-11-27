import { api } from './client';

/** Lists the playable themes: [{ slug, name, genre, story, timerMinutes, styleKey, roles }]. */
export const listThemes = () => api('/themes');

/** SCORE-6: { theme: { slug, name } | null, rows: [{ rank, teamName, points, levelsCleared, timeUsedMs, stars, challengeName, playedAt }] }. */
export const themeRankings = (slug) => api(`/themes/${encodeURIComponent(slug)}/rankings`);
