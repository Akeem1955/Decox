import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Colors, ThemeMode, ThemeColors } from './colors';

type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  preference: ThemePreference;
  colors: ThemeColors;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  preference: 'system',
  colors: Colors.dark,
  isDark: true,
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  const resolvedMode: ThemeMode =
    preference === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : preference;

  const isDark = resolvedMode === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider
      value={{ mode: resolvedMode, preference, colors, isDark, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
