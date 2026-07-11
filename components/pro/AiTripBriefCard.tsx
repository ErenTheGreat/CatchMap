import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isAiTripBriefEnabled } from '@/constants/features';
import { generateAiTripBrief } from '@/lib/ai/proAiFeatures';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';

interface AiTripBriefCardProps {
  spot: NearbySpot;
  weather?: WeatherSnapshot | null;
  coachAdvice?: CatchCoachAdvice | null;
  regulationNotices?: string[];
}

export default function AiTripBriefCard({
  spot,
  weather,
  coachAdvice,
  regulationNotices,
}: AiTripBriefCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAiTripBriefEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="AI Trip Brief"
        description="One-tap pre-trip summary: weather window, rig tip, and regulation reminders."
      />
    );
  }

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const { text, error: err } = await generateAiTripBrief({
      spot,
      weather,
      coachAdvice,
      regulationNotices,
    });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setBrief(text);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MapPin color={colors.accent} size={18} />
        <Text style={styles.title}>AI Trip Brief</Text>
      </View>
      <Text style={styles.spotName}>{spot.name}</Text>
      {brief ? (
        <Text style={styles.brief}>{brief}</Text>
      ) : (
        <Text style={styles.hint}>Get a quick go/no-go summary before you head out.</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={loading ? 'Building brief…' : brief ? 'Refresh brief' : 'Generate trip brief'}
        onPress={handleGenerate}
        loading={loading}
        variant="secondary"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    spotName: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    hint: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    brief: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 22,
    },
    error: {
      fontSize: FontSizes.sm,
      color: colors.error,
    },
  });
}
