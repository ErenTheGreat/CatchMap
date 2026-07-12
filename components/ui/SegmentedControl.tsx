import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { hapticLight } from '@/utils/haptics';
import ThemedText from '@/components/ui/ThemedText';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.segmented}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              hapticLight();
              onChange(option.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <ThemedText
              weight="medium"
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.md,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
    },
    segmentActive: {
      backgroundColor: colors.accent,
    },
    segmentText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    segmentTextActive: {
      color: colors.accentForeground,
    },
  });
}
