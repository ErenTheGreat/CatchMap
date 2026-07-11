import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Spacing, FontSizes, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { isCatchAiTabVisible } from '@/constants/features';
import CatchAiChat from '@/components/ai/CatchAiChat';
import { useCatchAi } from '@/hooks/useCatchAi';
import { useCatches } from '@/hooks/useCatches';
import { fishingApi } from '@/lib/api/fishingApi';
import { usePro } from '@/providers/ProProvider';

export default function AssistantScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isPro } = usePro();
  const {
    hasKey,
    usage,
    messages,
    sending,
    loadingHistory,
    clearChat,
    sendMessage,
    refresh,
  } = useCatchAi();
  const { data: catches = [] } = useCatches();
  const [error, setError] = useState<string | null>(null);

  const weatherQuery = useQuery({
    queryKey: ['assistantWeather'],
    queryFn: async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const loc = await Location.getCurrentPositionAsync({});
        return fishingApi.getWeather(loc.coords.latitude, loc.coords.longitude);
      } catch {
        return null;
      }
    },
    staleTime: 15 * 60 * 1000,
    retry: 0,
  });

  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      const weather = weatherQuery.data;
      const { error: sendError } = await sendMessage(text, {
        catches,
        weather: weather
          ? {
              temperature: weather.temperatureF,
              windSpeed: weather.windSpeedMph,
              conditions: weather.isDay ? 'daylight' : 'night',
            }
          : null,
      });
      if (sendError) {
        setError(sendError.message);
      }
      await refresh();
    },
    [sendMessage, catches, weatherQuery.data, refresh]
  );

  if (!isCatchAiTabVisible()) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.disabled}>Catch AI requires CatchMap Pro.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Sparkles color={colors.accent} size={22} />
        <View>
          <Text style={styles.title}>Catch AI</Text>
          <Text style={styles.subtitle}>
            {isPro ? 'Hosted Pro assistant' : 'Upgrade to Pro to unlock'}
          </Text>
        </View>
      </View>

      {!loadingHistory ? (
        <CatchAiChat
          messages={messages}
          sending={sending}
          hasKey={hasKey}
          usage={usage}
          onSend={handleSend}
          onClear={clearChat}
          error={error}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    disabled: {
      color: colors.textMuted,
      padding: Spacing.lg,
    },
  });
}
