import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/providers/ThemeProvider';

const ICON_SIZE = 20;

interface SettingsButtonProps {
  size?: number;
  variant?: 'default' | 'onDark';
}

export default function SettingsButton({ size = 40, variant = 'default' }: SettingsButtonProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const onDark = variant === 'onDark';

  return (
    <Pressable
      onPress={() => router.push('/settings')}
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
      accessibilityLabel="Open settings"
    >
      <Settings color={onDark ? '#FFFFFF' : colors.text} size={ICON_SIZE} />
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
