// Rabona - Modern dark theme with teal accent
export const colors = {
  // Primary colors - Teal/Cyan accent
  primary: '#00BFA6', // Teal accent
  primaryDark: '#00A896',
  primaryLight: '#5EEAD4',

  // Background colors - Dark theme
  background: '#0F172A', // Dark slate
  backgroundDark: '#020617',
  backgroundLight: '#1E293B',
  surface: '#1E293B', // Card/surface color

  // Text colors
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textLight: '#64748B',
  textOnPrimary: '#0F172A',

  // UI colors
  border: '#334155',
  divider: '#1E293B',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Status colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',

  // Accent colors
  accent: '#8B5CF6', // Purple for secondary actions
  accentLight: '#A78BFA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  // Font sizes
  h1: 32,
  h2: 28,
  h3: 24,
  h4: 20,
  body: 16,
  bodySmall: 14,
  caption: 12,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#00BFA6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
