import React, { createContext, useContext, useState, useEffect } from 'react';

const THEME_KEY = 'reviewhub_theme';

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Only apply to DOM — do NOT write to localStorage here.
    // localStorage is only written when the user explicitly toggles (see toggle below),
    // so the system-preference listener can check localStorage to know if the user has overridden.
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Listen for system theme changes (only when user hasn't set an explicit preference)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function handleChange(e) {
      // Only follow system if no explicit user preference is stored
      if (!localStorage.getItem(THEME_KEY)) {
        setDark(e.matches);
      }
    }
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      // Persist explicit user preference — this also prevents system changes from overriding
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
