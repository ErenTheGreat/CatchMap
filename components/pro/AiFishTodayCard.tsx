import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isAiFishTodayEnabled } from '@/constants/features';
import { generateAiFishTodayRanking } from '@/lib/ai/proAiFeatures';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';

interface AiFishTodayCardProps {
  topSpots: RankedDiscoverySpot[];
  weather?: WeatherSnapshot | null;
}

export default function AiFishTodayCard({ topSpots, weather }: AiFishTodayCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAiFishTodayEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="What should I fish today?"
        description="Pro AI ranks your best spots in view with plain-English reasoning."
      />
    );
  }

  const handleAsk = async () => {
    setLoading(true);
    setError(null);
    const { text, error: err } = await generateAiFishTodayRanking(topSpots, weather);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setResult(text);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sparkles color={colors.accent} size={18} />
        <Text style={styles.title}>What should I fish today?</Text>
      </View>
      {result ? (
        <Text style={styles.result}>{result}</Text>
      ) : (
        <Text style={styles.hint}>
          Pro AI picks your top 3 spots in view based on bite scores and conditions.
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={loading ? 'Thinking…' : result ? 'Refresh picks' : 'Ask Catch AI'}
        onPress={handleAsk}
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
    hint: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    result: {
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
