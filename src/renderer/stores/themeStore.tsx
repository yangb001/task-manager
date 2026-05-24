import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface ThemeConfig {
  mode: 'light' | 'dark';
  primaryColor: string;
  sidebarBg: string;
  contentBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderColor: string;
  hoverBg: string;
  activeBg: string;
  headerBg: string;
  fontFamily: string;
  borderRadius: number;
}

const lightTheme: ThemeConfig = {
  mode: 'light',
  primaryColor: '#0078d4',
  sidebarBg: '#f3f3f3',
  contentBg: '#ffffff',
  cardBg: '#ffffff',
  textPrimary: '#1a1a1a',
  textSecondary: '#616161',
  textMuted: '#a0a0a0',
  borderColor: '#e0e0e0',
  hoverBg: '#eaeaea',
  activeBg: '#d0d0d0',
  headerBg: '#f3f3f3',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, sans-serif',
  borderRadius: 6,
};

const darkTheme: ThemeConfig = {
  mode: 'dark',
  primaryColor: '#60cdff',
  sidebarBg: '#2d2d2d',
  contentBg: '#1e1e1e',
  cardBg: '#252526',
  textPrimary: '#cccccc',
  textSecondary: '#969696',
  textMuted: '#6e6e6e',
  borderColor: '#3c3c3c',
  hoverBg: '#383838',
  activeBg: '#454545',
  headerBg: '#2d2d2d',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, sans-serif',
  borderRadius: 6,
};

interface ThemeContextType {
  theme: ThemeConfig;
  toggleMode: () => void;
  setPrimaryColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  toggleMode: () => {},
  setPrimaryColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('tm-theme');
      if (saved) return JSON.parse(saved);
    } catch {}
    return lightTheme;
  });

  const setTheme = useCallback((partial: Partial<ThemeConfig>) => {
    setThemeState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('tm-theme', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setThemeState(prev => {
      const base = prev.mode === 'light' ? darkTheme : lightTheme;
      const next = { ...base, primaryColor: prev.primaryColor };
      localStorage.setItem('tm-theme', JSON.stringify(next));
      return next;
    });
  }, []);

  const setPrimaryColor = useCallback((color: string) => setTheme({ primaryColor: color }), [setTheme]);

  useEffect(() => {
    document.body.style.background = theme.contentBg;
    document.body.style.color = theme.textPrimary;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleMode, setPrimaryColor }}>
      {children}
    </ThemeContext.Provider>
  );
};