import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Fish, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useTripFeedbackPrompt } from '@/hooks/useTripFeedbackPrompt';
import type { TripOutcomeRating } from '@/utils/tripFeedback';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const OUTCOME_OPTIONS: { id: TripOutcomeRating; label: string; emoji: string }[] = [
  { id: 'slow', label: 'Slow', emoji: '🐢' },
  { id: 'fair', label: 'Fair', emoji: '🎣' },
  { id: 'hot', label: 'Hot', emoji: '🔥' },
];

export function TripFeedbackPrompt() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { pending, stats, submitRating, dismiss } = useTripFeedbackPrompt();

  if (!pending) return null;

  const handleRate = async (outcome: TripOutcomeRating) => {
    hapticSuccess();
    await submitRating(outcome);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void dismiss()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Fish color={colors.accent} size={20} />
            <Text style={styles.title}>How was the bite?</Text>
            <Pressable
              onPress={() => {
                hapticLight();
                void dismiss();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss trip feedback"
            >
              <X color={colors.textMuted} size={20} />
            </Pressable>
          </View>

          {pending.spotName ? (
            <Text style={styles.subtitle}>At {pending.spotName}</Text>
          ) : null}

          <Text style={styles.body}>
            Your rating helps CatchMap learn your personal patterns and improve forecasts.
          </Text>

          {stats.totalRated >= 3 && stats.accuracyPct > 0 ? (
            <Text style={styles.stats}>
              CatchMap called {stats.accurateCount} of your last {stats.totalRated} rated trips
              correctly ({stats.accuracyPct}%).
            </Text>
          ) : null}

          <View style={styles.optionsRow}>
            {OUTCOME_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={styles.optionButton}
                onPress={() => void handleRate(option.id)}
                accessibilityRole="button"
                accessibilityLabel={`Rate bite as ${option.label}`}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      width: '100%',
      maxWidth: 360,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
    },
    body: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    stats: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    optionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    optionButton: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.cardLight,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    optionEmoji: {
      fontSize: 24,
    },
    optionLabel: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
      color: colors.text,
    },
  });
}
