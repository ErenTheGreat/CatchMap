import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Sparkles, ExternalLink, KeyRound } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, TextField } from '@/components/ui';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

interface CatchAiSetupCardProps {
  onKeySaved?: () => void;
  onTestKey: (key: string) => Promise<boolean>;
  onSaveKey: (key: string) => Promise<void>;
  compact?: boolean;
}

export default function CatchAiSetupCard({
  onKeySaved,
  onTestKey,
  onSaveKey,
  compact = false,
}: CatchAiSetupCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError('Paste your Google API key first.');
      return;
    }
    setSaving(true);
    setTesting(true);
    setError(null);
    try {
      const ok = await onTestKey(trimmed);
      if (!ok) {
        setError('Key test failed. Check the key and try again.');
        return;
      }
      await onSaveKey(trimmed);
      setApiKey('');
      setSuccess(true);
      onKeySaved?.();
    } finally {
      setSaving(false);
      setTesting(false);
    }
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <Sparkles color={colors.accent} size={20} />
        <View style={styles.headerText}>
          <Text style={styles.title}>Set up Catch AI</Text>
          <Text style={styles.subtitle}>
            CatchMap is free — AI uses your own Google Gemini key (free tier). You pay Google
            directly, not us.
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => Linking.openURL(AI_STUDIO_URL)}
        accessibilityRole="link"
        accessibilityLabel="Get a free API key from Google AI Studio"
      >
        <ExternalLink color={colors.accent} size={16} />
        <Text style={styles.linkText}>Get a free key at Google AI Studio</Text>
      </TouchableOpacity>

      <TextField
        label="Gemini API key"
        placeholder="AIza..."
        value={apiKey}
        onChangeText={(t) => {
          setApiKey(t);
          setError(null);
          setSuccess(false);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={error ?? undefined}
      />

      <Button
        title={saving ? 'Saving…' : 'Save & test key'}
        onPress={handleSave}
        loading={saving || testing}
        icon={<KeyRound color={colors.accentForeground} size={18} />}
      />

      {success ? (
        <Text style={styles.successText}>Key saved. Catch AI is ready to use.</Text>
      ) : null}

      <Text style={styles.disclaimer}>
        Free tier is roughly 1,500 requests/day on Gemini Flash. CatchMap tracks your personal
        daily budget (default 100) and warns you before you hit it.
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accentDark,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    cardCompact: {
      padding: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'flex-start',
    },
    headerText: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: colors.accent,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    linkText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    successText: {
      color: colors.success,
      fontSize: FontSizes.sm,
    },
    disclaimer: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 16,
    },
  });
}
