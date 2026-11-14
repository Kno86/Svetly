'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import styles from './shell.module.css';

export const THEME_KEY = 'svetly:theme';

/** Runs before paint (inline in <head>) so the saved theme applies without a flash. */
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: theme applies for this page only */
    }
  }

  return (
    <button
      type="button"
      className={className ?? styles.iconButton}
      onClick={toggle}
      aria-pressed={dark}
      aria-label="Тёмная тема"
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
    >
      {dark ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
    </button>
  );
}
