import { useColorScheme } from 'react-native';

export const palette = {
  purple: {
    50: '#F5F3FF',
    100: '#EDE9FE',
    200: '#DDD6FE',
    500: '#8B5CF6',
    600: '#7C3AED',
    700: '#6D28D9',
  },
  blue: {
    500: '#3B82F6',
    600: '#2563EB',
  },
  green: {
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
  },
  orange: {
    400: '#FB923C',
    500: '#F59E0B',
  },
  red: {
    400: '#F87171',
    500: '#EF4444',
  },
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};

const lightColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  backgroundTertiary: '#E5E5EA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F2F7',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  text: '#000000',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  accent: '#7C3AED',
  accentLight: '#EDE9FE',
  accentMuted: '#DDD6FE',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  overlay: 'rgba(0,0,0,0.4)',
  cardShadow: 'rgba(0,0,0,0.08)',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  headerBg: '#FFFFFF',
  inputBg: '#F2F2F7',
  white: '#FFFFFF',
  black: '#000000',
};

const darkColors: typeof lightColors = {
  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  border: '#38383A',
  borderLight: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5CC',
  textTertiary: '#EBEBF599',
  accent: '#A78BFA',
  accentLight: '#2D1B69',
  accentMuted: '#3D2882',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FB923C',
  warningLight: '#451A03',
  error: '#F87171',
  errorLight: '#450A0A',
  blue: '#60A5FA',
  blueLight: '#1E3A5F',
  overlay: 'rgba(0,0,0,0.7)',
  cardShadow: 'rgba(0,0,0,0.3)',
  tabBar: '#1C1C1E',
  tabBarBorder: '#38383A',
  headerBg: '#000000',
  inputBg: '#1C1C1E',
  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 34,
  hero: 42,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

export type Colors = typeof lightColors;
