import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { Anchor, Clock, Fish, Info, TrendingUp, X } from 'lucide-react-native';
import RigListSection from '@/components/rigs/RigListSection';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { LocationSpeciesGuide } from '@/lib/types/speciesGuide';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';
import CatchCoachCard from '@/components/coach/CatchCoachCard';
import { getActivityRatingColor } from '@/lib/types/speciesPrediction';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';

interface SpeciesGuideSheetProps {
  guide: LocationSpeciesGuide | null;
  spotName?: string;
  coachAdvice?: CatchCoachAdvice | null;
  onClose: () => void;
  onLogFish?: (speciesName: string, advice?: CatchCoachAdvice) => void;
}

function ChipList({
  items,
  color,
  styles,
}: {
  items: string[];
  color?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={[styles.chipText, color ? { color } : undefined]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SpeciesGuideSheet({
  guide,
  spotName,
  coachAdvice,
  onClose,
  onLogFish,
}: SpeciesGuideSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isWide, modalMaxWidth } = useResponsiveLayout();

  if (!guide) return null;

  const activityColor = getActivityRatingColor(guide.activityRating);
  const probability = guide.prediction?.probability;
  const factors = guide.prediction?.factors ?? [];

  return (
    <Modal
      visible={!!guide}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, isWide && styles.overlayWide]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.container,
            isWide && { maxWidth: modalMaxWidth, borderRadius: BorderRadius.xl },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Species Guide</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close species guide"
            >
              <X color={colors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.speciesHeader}>
              <View style={styles.speciesIcon}>
                {guide.imageUrl ? (
                  <Image source={{ uri: guide.imageUrl }} style={styles.speciesImage} />
                ) : (
                  <Fish color={colors.accent} size={24} />
                )}
              </View>
              <View style={styles.speciesInfo}>
                <Text style={styles.speciesName}>{guide.species.name}</Text>
                {guide.species.scientificName ? (
                  <Text style={styles.scientificName}>{guide.species.scientificName}</Text>
                ) : null}
                {spotName ? (
                  <Text style={styles.spotName}>at {spotName}</Text>
                ) : null}
              </View>
              <View
                style={[styles.activityBadge, { borderColor: activityColor }]}
                accessibilityLabel={`Activity rating: ${guide.activityRating}`}
              >
                <Text style={[styles.activityText, { color: activityColor }]}>
                  {probability != null ? `${probability}%` : guide.activityRating}
                </Text>
              </View>
            </View>

            {probability != null ? (
              <View style={styles.probabilitySection}>
                <Text style={styles.probabilityTitle}>
                  Catch probability: {probability}%
                </Text>
                <View style={styles.probabilityBarTrack}>
                  <View
                    style={[
                      styles.probabilityBarFill,
                      {
                        width: `${probability}%`,
                        backgroundColor: activityColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.probabilitySubtext}>
                  {guide.activityRating} activity · tap factors below for details
                </Text>
              </View>
            ) : null}

            {factors.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <TrendingUp color={colors.accent} size={16} />
                  <Text style={styles.sectionTitle}>Prediction Factors</Text>
                </View>
                {factors.map((factor) => (
                  <View key={`${factor.name}-${factor.detail}`} style={styles.factorRow}>
                    <Text
                      style={[
                        styles.factorImpact,
                        factor.impact === '+'
                          ? styles.factorPositive
                          : factor.impact === '-'
                            ? styles.factorNegative
                            : styles.factorNeutral,
                      ]}
                    >
                      {factor.impact === '+' ? '+' : factor.impact === '-' ? '−' : '○'}
                    </Text>
                    <View style={styles.factorTextBlock}>
                      <Text style={styles.factorName}>{factor.name}</Text>
                      <Text style={styles.factorDetail}>{factor.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {coachAdvice ? (
              <CatchCoachCard advice={coachAdvice} compact />
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Info color={colors.accent} size={16} />
                <Text style={styles.sectionTitle}>How to Catch</Text>
              </View>
              <Text style={styles.bodyText}>{guide.howToCatch}</Text>
              {!guide.hasCatalogData && !guide.primaryRig ? (
                <Text style={styles.fallbackNote}>
                  Detailed tackle info is not available for this species yet.
                </Text>
              ) : null}
              {!guide.hasCatalogData && guide.primaryRig ? (
                <Text style={styles.fallbackNote}>
                  Provisional guide — verify species ID and local regulations before keeping fish.
                </Text>
              ) : null}
            </View>

            {guide.primaryRig ? (
              <View style={styles.section}>
                <RigListSection
                  rigs={[
                    guide.primaryRig,
                    ...(guide.alternateRigs ?? []),
                  ]}
                  compact
                  title="Recommended Rig"
                />
              </View>
            ) : null}

            {guide.hookSize ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Anchor color={colors.accent} size={16} />
                  <Text style={styles.sectionTitle}>Hook Size</Text>
                </View>
                <Text style={styles.bodyText}>{guide.hookSize}</Text>
              </View>
            ) : null}

            {guide.bait.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Best Bait</Text>
                <ChipList items={guide.bait} styles={styles} />
              </View>
            ) : null}

            {guide.lures.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recommended Lures</Text>
                <ChipList items={guide.lures} color={colors.accent} styles={styles} />
              </View>
            ) : null}

            {guide.habitat ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Habitat</Text>
                <Text style={styles.bodyText}>{guide.habitat}</Text>
              </View>
            ) : null}

            {guide.averageWeight ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Average Weight</Text>
                <Text style={styles.bodyText}>{guide.averageWeight}</Text>
              </View>
            ) : null}

            {guide.bestCatchTimes.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Clock color={colors.accent} size={16} />
                  <Text style={styles.sectionTitle}>Best Times at This Spot</Text>
                </View>
                {guide.bestCatchTimes.map((slot) => (
                  <View key={slot.hour} style={styles.timeChip}>
                    <Clock color={colors.accent} size={12} />
                    <Text style={styles.timeChipText}>
                      {slot.label} — {slot.catchCount}{' '}
                      {slot.catchCount === 1 ? 'catch' : 'catches'} logged
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {onLogFish ? (
              <TouchableOpacity
                style={styles.logButton}
                onPress={() => onLogFish(guide.species.name, coachAdvice ?? undefined)}
              >
                <Fish color={colors.accentForeground} size={16} />
                <Text style={styles.logButtonText}>Log This Fish</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayWide: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: Platform.OS === 'web' ? '85%' : '88%',
      padding: Spacing.lg,
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    speciesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    speciesIcon: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    speciesImage: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.md,
    },
    speciesInfo: {
      flex: 1,
      minWidth: 0,
    },
    speciesName: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
    },
    scientificName: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      fontStyle: 'italic',
      marginTop: 2,
    },
    spotName: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
    activityBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
    },
    activityText: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    probabilitySection: {
      marginBottom: Spacing.md,
      padding: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    probabilityTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
    },
    probabilityBarTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
      marginBottom: Spacing.xs,
    },
    probabilityBarFill: {
      height: 6,
      borderRadius: BorderRadius.full,
    },
    probabilitySubtext: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
    },
    factorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
      paddingVertical: 4,
    },
    factorImpact: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      width: 16,
      textAlign: 'center',
    },
    factorPositive: {
      color: colors.success,
    },
    factorNegative: {
      color: colors.error,
    },
    factorNeutral: {
      color: colors.textMuted,
    },
    factorTextBlock: {
      flex: 1,
    },
    factorName: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    factorDetail: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginTop: 1,
    },
    section: {
      marginBottom: Spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
    },
    bodyText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    fallbackNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      fontStyle: 'italic',
      marginTop: Spacing.xs,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    chipText: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
    },
    timeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.cardLight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.xs,
    },
    timeChipText: {
      color: colors.text,
      fontSize: FontSizes.sm,
    },
    logButton: {
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    logButtonText: {
      color: colors.accentForeground,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
  });
}
