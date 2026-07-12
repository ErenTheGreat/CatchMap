export type ThemeColors = {
  background: string;
  card: string;
  cardLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentDark: string;
  accentForeground: string;
  brandNavy: string;
  brandAccent: string;
  brandAccentMuted: string;
  brandAccentForeground: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  shadow: string;
  skeleton: string;
  toastSuccess: string;
  toastWarning: string;
  toastError: string;
  overlay: string;
  surfaceElevated: string;
  warningSurface: string;
  errorSurface: string;
  successSurface: string;
  mapPinBorder: string;
  /** Bite activity pin colors (map clusters & legend) */
  activityHigh: string;
  activityMedium: string;
  activityLow: string;
  activityGood: string;
  activityExcellent: string;
  /** Community catch intel accent */
  community: string;
  communityMuted: string;
  heroGradientEnd: string;
};

export const LightColors: ThemeColors = {
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardLight: '#F5F5F5',
  text: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',
  accent: '#2563EB',
  accentDark: '#DBEAFE',
  accentForeground: '#FFFFFF',
  brandNavy: '#0F1F3D',
  brandAccent: '#2563EB',
  brandAccentMuted: '#DBEAFE',
  brandAccentForeground: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E5E5E5',
  shadow: '#000000',
  skeleton: '#E8E8E8',
  toastSuccess: '#10B981',
  toastWarning: '#F59E0B',
  toastError: '#EF4444',
  overlay: 'rgba(0, 0, 0, 0.5)',
  surfaceElevated: 'rgba(255, 255, 255, 0.97)',
  warningSurface: 'rgba(245, 158, 11, 0.12)',
  errorSurface: 'rgba(239, 68, 68, 0.1)',
  successSurface: '#ECFDF5',
  mapPinBorder: '#FFFFFF',
  activityHigh: '#10B981',
  activityMedium: '#F59E0B',
  activityLow: '#94A3B8',
  activityGood: '#0EA5E9',
  activityExcellent: '#047857',
  community: '#7C3AED',
  communityMuted: 'rgba(124, 58, 237, 0.12)',
  heroGradientEnd: '#1A3560',
};

/** Slate palette tuned for low-light / outdoor use at night. */
export const DarkColors: ThemeColors = {
  background: '#0B1220',
  card: '#151D2E',
  cardLight: '#1C2738',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accent: '#60A5FA',
  accentDark: 'rgba(96, 165, 250, 0.15)',
  accentForeground: '#0B1220',
  brandNavy: '#0F1F3D',
  brandAccent: '#60A5FA',
  brandAccentMuted: 'rgba(96, 165, 250, 0.15)',
  brandAccentForeground: '#0B1220',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  border: '#2D3A4F',
  shadow: '#000000',
  skeleton: '#243044',
  toastSuccess: '#059669',
  toastWarning: '#D97706',
  toastError: '#DC2626',
  overlay: 'rgba(0, 0, 0, 0.65)',
  surfaceElevated: 'rgba(21, 29, 46, 0.97)',
  warningSurface: 'rgba(251, 191, 36, 0.14)',
  errorSurface: 'rgba(248, 113, 113, 0.12)',
  successSurface: 'rgba(52, 211, 153, 0.12)',
  mapPinBorder: '#1C2738',
  activityHigh: '#34D399',
  activityMedium: '#FBBF24',
  activityLow: '#64748B',
  activityGood: '#38BDF8',
  activityExcellent: '#047857',
  community: '#A78BFA',
  communityMuted: 'rgba(167, 139, 250, 0.15)',
  heroGradientEnd: '#1A3560',
};

/**
 * High-contrast palette for direct sunlight / glare.
 * Warm paper background, near-black text, saturated accents (WCAG AA+ on body text).
 */
export const OutdoorColors: ThemeColors = {
  background: '#F8F4E8',
  card: '#FFFFFF',
  cardLight: '#F0EBD8',
  text: '#0A0A0A',
  textSecondary: '#1F2937',
  textMuted: '#4B5563',
  accent: '#0057B8',
  accentDark: '#B3D4FC',
  accentForeground: '#FFFFFF',
  brandNavy: '#0F1F3D',
  brandAccent: '#0057B8',
  brandAccentMuted: '#B3D4FC',
  brandAccentForeground: '#FFFFFF',
  success: '#047857',
  warning: '#B45309',
  error: '#B91C1C',
  border: '#1A1A1A',
  shadow: '#000000',
  skeleton: '#D6D0BC',
  toastSuccess: '#047857',
  toastWarning: '#B45309',
  toastError: '#B91C1C',
  overlay: 'rgba(0, 0, 0, 0.55)',
  surfaceElevated: 'rgba(255, 255, 255, 0.98)',
  warningSurface: 'rgba(180, 83, 9, 0.14)',
  errorSurface: 'rgba(185, 28, 28, 0.1)',
  successSurface: '#D1FAE5',
  mapPinBorder: '#0A0A0A',
  activityHigh: '#047857',
  activityMedium: '#B45309',
  activityLow: '#6B7280',
  activityGood: '#0369A1',
  activityExcellent: '#065F46',
  community: '#6D28D9',
  communityMuted: 'rgba(109, 40, 217, 0.14)',
  heroGradientEnd: '#1E3A5F',
};

/** @deprecated Use useTheme().colors — kept for map style helpers during migration */
export const Colors = LightColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const FontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

/** DM Sans families — fall back to system when fonts are still loading. */
export const FontFamily = {
  brand: 'DMSans_700Bold',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
} as const;

export const BRAND_TAGLINE = 'Fishing Spots & Log';

/** Map pin palette derived from theme tokens (usable outside React context). */
export function getMapActivityPinColors(isDark: boolean, isOutdoor = false) {
  const c = isOutdoor ? OutdoorColors : isDark ? DarkColors : LightColors;
  return {
    slow: c.activityLow,
    fair: c.activityMedium,
    good: c.activityGood,
    hot: c.activityHigh,
    excellent: c.activityExcellent,
    community: c.community,
    communityMuted: c.communityMuted,
    pinBorder: c.mapPinBorder,
    peakFill: c.activityHigh,
    countText: isOutdoor || !isDark ? '#FFFFFF' : c.accentForeground,
  };
}
