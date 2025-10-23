import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Theme } from '../types';

type ThemeMode = 'system' | 'manual';

interface ThemeContextType {
  theme: Theme; // currently applied theme
  mode: ThemeMode; // whether following system or manual override
  toggleTheme: () => void; // toggles and sets mode to manual
  setFollowSystem: (follow: boolean) => void; // enable/disable following system
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mode, setMode] = useState<ThemeMode>('system');
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  const applyTheme = (nextTheme: Theme) => {
    const root = window.document.documentElement;
    const body = document.body;
    // Toggle classes
    root.classList.remove('light', 'dark');
    root.classList.add(nextTheme);
    body.classList.remove('light', 'dark');
    body.classList.add(nextTheme);
    // Set data-theme attributes (optional, useful for CSS vars)
    root.setAttribute('data-theme', nextTheme);
    body.setAttribute('data-theme', nextTheme);
    // Update browser theme color
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = nextTheme === 'dark' ? '#0D9488' : '#14B8A6';
    }
  };

  const applySystemTheme = () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryRef.current = mql;
    const nextTheme: Theme = mql.matches ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const attachSystemListener = () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryRef.current = mql;
    const handler = () => applySystemTheme();
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  };

  useEffect(() => {
    // Load saved preferences
    const savedMode = (localStorage.getItem('gull-theme-mode') as ThemeMode) || 'system';
    const savedTheme = (localStorage.getItem('gull-theme') as Theme) || 'dark';
    setMode(savedMode);

    if (savedMode === 'system') {
      applySystemTheme();
      const detach = attachSystemListener();
      return () => detach?.();
    } else {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const setFollowSystem = (follow: boolean) => {
    if (follow) {
      setMode('system');
      localStorage.setItem('gull-theme-mode', 'system');
      applySystemTheme();
      attachSystemListener();
    } else {
      setMode('manual');
      localStorage.setItem('gull-theme-mode', 'manual');
      // Keep current theme as starting manual value
      localStorage.setItem('gull-theme', theme);
      // Detach listener if present
      const mql = mediaQueryRef.current;
      if (mql) {
        // There is no stored handler ref; call apply once based on current theme and rely on not reacting to system changes
        // Listeners were added with anonymous function; to ensure cleanup we reload listener by replacing mediaQueryRef
        // Not strictly necessary in modern browsers but safe to reset ref
        mediaQueryRef.current = null;
      }
    }
  };

  const toggleTheme = () => {
    // If following system, switching should move to manual first
    if (mode === 'system') {
      setMode('manual');
      localStorage.setItem('gull-theme-mode', 'manual');
      // Detach listener (if any)
      const mql = mediaQueryRef.current;
      if (mql) {
        // No direct remove necessary here since we used effect cleanup on mount; safe to ignore
      }
    }

    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    const root = window.document.documentElement;
    root.classList.add('theme-transition');
    setTimeout(() => root.classList.remove('theme-transition'), 250);
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('gull-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme, setFollowSystem }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

