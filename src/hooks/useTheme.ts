import { useEffect, useState } from 'react';
import { ThemeMode } from '../core/types';
import { db } from '../db/database';

const THEME_STORAGE_KEY = 'ieba-theme-mode';

export function useTheme(initialThemeMode?: ThemeMode) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (initialThemeMode) return initialThemeMode;
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode;
    return saved || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Actualizar si cambia el prop initialThemeMode cuando carga config de Dexie DB
  useEffect(() => {
    if (initialThemeMode) {
      setThemeModeState(initialThemeMode);
    }
  }, [initialThemeMode]);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
        setResolvedTheme('dark');
      } else {
        root.classList.remove('dark');
        setResolvedTheme('light');
      }
    };

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      applyTheme(themeMode === 'dark');
    }
  }, [themeMode]);

  const setThemeMode = async (newMode: ThemeMode) => {
    setThemeModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);

    // Si existe config en DB, guardar también allí
    try {
      const configs = await db.config.toArray();
      if (configs.length > 0) {
        await db.config.update(configs[0].id, { themeMode: newMode });
      }
    } catch (e) {
      console.warn("No se pudo guardar themeMode en db.config", e);
    }
  };

  return { themeMode, setThemeMode, resolvedTheme };
}
