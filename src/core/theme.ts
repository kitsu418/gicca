// Theme switcher.
//
// The user picks between 'default' (dark slate / sky accent / rounded /
// shadowed cards) and 'brutalist' (pure black / white borders / no
// rounding / electric-yellow accent). The choice persists in meta and is
// applied as data-theme on <html> so the `brutalist:` Tailwind variant
// (declared in index.css) kicks in across the tree.

import { meta } from './db';
import type { ThemeName } from './types';

const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  if (theme === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export async function loadTheme(): Promise<ThemeName> {
  const stored = await meta.get('theme');
  return stored ?? 'default';
}

export async function saveTheme(theme: ThemeName): Promise<void> {
  await meta.set('theme', theme);
  applyTheme(theme);
  notify();
}

export function subscribeTheme(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
