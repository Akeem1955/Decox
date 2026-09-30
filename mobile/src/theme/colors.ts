export const Colors = {
  // Brand
  accent: '#FF6B00',
  accentLight: '#FF8C33',
  accentMuted: 'rgba(255, 107, 0, 0.15)',

  // Dark theme
  dark: {
    bg: '#0E0E0E',
    surface: '#1A1A1A',
    surfaceAlt: '#242424',
    border: '#2E2E2E',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#666666',
    input: '#1E1E1E',
    inputBorder: '#333333',
    placeholder: '#555555',
    icon: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.6)',
    card: '#1C1C1C',
  },

  // Light theme
  light: {
    bg: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F3F0',
    border: '#E8E4DF',
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    input: '#FFFFFF',
    inputBorder: '#E8E4DF',
    placeholder: '#9CA3AF',
    icon: '#111827',
    overlay: 'rgba(0,0,0,0.4)',
    card: '#FFFFFF',
  },
} as const;

export type ThemeMode = 'dark' | 'light';
export type ThemeColors = { [K in keyof typeof Colors.dark]: string };
