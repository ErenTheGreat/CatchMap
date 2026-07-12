import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Camera, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isWaterWhisperEnabled } from '@/constants/features';
import { analyzeWaterScene } from '@/lib/ai/waterWhisper';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/recommendations';
import { hapticLight } from '@/utils/haptics';

interface WaterWhisperCardProps {
  spot: NearbySpot;
  weather?: WeatherSnapshot | null;
  topSpecies?: string | null;
}

export default function WaterWhisperCard({ spot, weather, topSpecies }: WaterWhisperCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!isWaterWhisperEnabled()) return;
    hapticLight();

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is required to read the water.');
      return;
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.45,
      base64: true,
    });

    if (picked.canceled || !picked.assets[0]?.base64) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const analysis = await analyzeWaterScene({
      imageBase64: picked.assets[0].base64,
      mimeType: picked.assets[0].mimeType ?? 'image/jpeg',
      spot,
      weather,
      topSpecies,
    });

    setLoading(false);
    if (analysis.error) {
      setError(analysis.error);
      return;
    }
    setResult(analysis.text);
  }, [spot, weather, topSpecies]);

  if (!isWaterWhisperEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="Water Whisper"
        description="Snap the lake — AI reads clarity, cover, and suggests tactics."
      />
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Sparkles color={colors.accent} size={18} />
        <Text style={styles.title}>Water Whisper</Text>
      </View>
      <Text style={styles.hint}>Photo-read the water for depth approach and lure picks.</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => void handleAnalyze()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Snap water photo for AI analysis"
      >
        {loading ? (
          <ActivityIndicator color={colors.accentForeground} size="small" />
        ) : (
          <>
            <Camera color={colors.accentForeground} size={18} />
            <Text style={styles.buttonText}>Snap the water</Text>
          </>
        )}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? <Text style={styles.result}>{result}</Text> : null}
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
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
    },
    buttonText: {
      color: colors.accentForeground,
      fontWeight: FontWeights.semibold,
      fontSize: FontSizes.sm,
    },
    error: {
      color: colors.error,
      fontSize: FontSizes.sm,
    },
    result: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 21,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
    },
  });
}
