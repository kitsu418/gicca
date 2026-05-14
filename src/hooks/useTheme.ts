import { useEffect, useState } from 'react';
import { loadTheme, subscribeTheme } from '../core/theme';
import type { ThemeName } from '../core/types';

/**
 * Reads the active theme and re-renders when it changes. Components that
 * need to swap markup (not just CSS classes) use this hook.
 */
export function useTheme(): ThemeName {
  const [theme, setTheme] = useState<ThemeName>('default');
  useEffect(() => {
    void loadTheme().then(setTheme);
    const unsub = subscribeTheme(() => {
      void loadTheme().then(setTheme);
    });
    return unsub;
  }, []);
  return theme;
}
