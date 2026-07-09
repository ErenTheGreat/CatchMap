import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Moon, Sun, Smartphone, SunMedium } from 'lucide-react-native';
import { BorderRadius } from '@/constants/theme';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';

const ICON_SIZE = 20;

function iconForPreference(preference: ThemePreference) {
  switch (preference) {
    case 'outdoor':
      return SunMedium;
    case 'dark':
      return Moon;
    case 'light':
      return Sun;
    default:
      return Smartphone;
  }
}

function labelForPreference(preference: ThemePreference) {
  switch (preference) {
    case 'outdoor':
      return 'Theme: outdoor high contrast';
    case 'system':
      return 'Theme: match system';
    case 'dark':
      return 'Theme: dark';
    default:
      return 'Theme: light';
  }
}

interface ThemeToggleButtonProps {
  size?: number;
  variant?: 'default' | 'onDark';
}

export default function ThemeToggleButton({ size = 40, variant = 'default' }: ThemeToggleButtonProps) {
  const { colors, preference, cyclePreference } = useTheme();
  const Icon = iconForPreference(preference);
  const onDark = variant === 'onDark';

  return (
    <Pressable
      onPress={cyclePreference}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          backgroundColor: onDark ? 'rgba(255,255,255,0.12)' : colors.surfaceElevated,
          borderColor: onDark ? 'rgba(255,255,255,0.2)' : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={labelForPreference(preference)}
      accessibilityHint="Cycles between system, light, dark, and outdoor high contrast"
    >
      <Icon color={onDark ? '#FFFFFF' : colors.text} size={ICON_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
});
