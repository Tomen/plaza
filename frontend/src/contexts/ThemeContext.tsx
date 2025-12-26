import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'neon' | 'grayscale';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = 'onchain-chat-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or default to 'neon'
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return (stored === 'grayscale' || stored === 'neon') ? stored : 'neon';
  });

  // Apply theme to document root
  useEffect(() => {
    if (theme === 'grayscale') {
      document.documentElement.setAttribute('data-theme', 'grayscale');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'neon' ? 'grayscale' : 'neon');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
