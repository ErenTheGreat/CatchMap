import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface CatchDateTimeFieldProps {
  value: number;
  onChange: (timestamp: number) => void;
}

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CatchDateTimeField({ value, onChange }: CatchDateTimeFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Date &amp; time caught</Text>
      <input
        type="datetime-local"
        value={toLocalInputValue(value)}
        max={toLocalInputValue(Date.now())}
        onChange={(e) => {
          const next = e.target.value ? new Date(e.target.value).getTime() : Date.now();
          if (!Number.isNaN(next)) onChange(next);
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: colors.card,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          borderRadius: BorderRadius.md,
          padding: Spacing.md,
          fontSize: FontSizes.md,
        }}
        aria-label="Date and time caught"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      marginBottom: Spacing.xs,
    },
  });
}
