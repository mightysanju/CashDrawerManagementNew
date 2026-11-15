import { useState, useEffect } from 'react';

export function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('frontdesk_theme');
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(isDark: boolean) {
  if (typeof document === 'undefined') return;
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    localStorage.setItem('frontdesk_theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    localStorage.setItem('frontdesk_theme', 'light');
  }
}

// Global listeners for instant sync across all components
const listeners = new Set<(isDark: boolean) => void>();

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const dark = getInitialTheme();
    applyTheme(dark);
    return dark;
  });

  useEffect(() => {
    const listener = (val: boolean) => setIsDark(val);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      applyTheme(next);
      listeners.forEach((l) => l(next));
      return next;
    });
  };

  return { isDark, toggleTheme };
}
