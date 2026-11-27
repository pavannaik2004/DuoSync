import { useEffect } from 'react';

/**
 * UI-2 fonts per style key (docs/themed-puzzle-sets.md): display family, then body family.
 * Loaded on demand, one stylesheet link per key, never removed (D101).
 */
export const THEME_FONTS = {
  cyber: 'family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;700',
  noir: 'family=Playfair+Display:wght@700&family=Lora:wght@400;700',
  orbital: 'family=Orbitron:wght@500;700&family=Exo+2:wght@400;700',
  pirate: 'family=Pirata+One&family=Crimson+Text:wght@400;700',
  haunted: 'family=Special+Elite&family=EB+Garamond:wght@400;700',
  tomb: 'family=Cinzel:wght@600;700&family=Cormorant+Garamond:wght@500;700',
  arcane: 'family=Uncial+Antiqua&family=Alegreya:wght@400;700',
  polar: 'family=Rajdhani:wght@600;700&family=Source+Sans+3:wght@400;700',
};

function loadFonts(key) {
  const id = `theme-fonts-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${THEME_FONTS[key]}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Applies a theme's look to the page while the calling component is mounted (UI-2, D100):
 * sets data-theme on <html>, and puts `default` back on unmount. Unknown keys use `default`.
 */
export default function useThemeStyle(styleKey) {
  useEffect(() => {
    const key = Object.hasOwn(THEME_FONTS, styleKey || '') ? styleKey : 'default';
    if (key !== 'default') loadFonts(key);
    document.documentElement.dataset.theme = key;
    return () => {
      document.documentElement.dataset.theme = 'default';
    };
  }, [styleKey]);
}
