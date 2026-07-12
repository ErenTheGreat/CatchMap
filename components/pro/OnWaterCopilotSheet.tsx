import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { Mic, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useOnWaterCopilot, type OnWaterCopilotContext } from '@/hooks/useOnWaterCopilot';
import { hapticLight } from '@/utils/haptics';

const QUICK_CHIPS = [
  "What's biting here right now?",
  'Best lure for these conditions?',
  'Should I move or stay?',
  "What's the tide doing?",
] as const;

interface OnWaterCopilotSheetProps {
  visible: boolean;
  onClose: () => void;
  context: OnWaterCopilotContext;
}

export default function OnWaterCopilotSheet({
  visible,
  onClose,
  context,
}: OnWaterCopilotSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [question, setQuestion] = useState('');
  const { ask, loading, answer, error, reset } = useOnWaterCopilot(context);

  const subtitle = useMemo(() => {
    if (context.spot?.name) return `At ${context.spot.name}`;
    return 'Using your GPS pin';
  }, [context.spot?.name]);

  const handleAsk = async (value: string) => {
    hapticLight();
    setQuestion(value);
    await ask(value);
  };

  const handleClose = () => {
    reset();
    setQuestion('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Mic color={colors.accent} size={20} />
              <Text style={styles.title}>On-Water Copilot</Text>
            </View>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close copilot">
              <X color={colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {QUICK_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.chip}
                onPress={() => void handleAsk(chip)}
                disabled={loading}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask what's biting…"
              placeholderTextColor={colors.textMuted}
              editable={!loading}
              onSubmitEditing={() => void handleAsk(question)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.askButton, loading && styles.askButtonDisabled]}
              onPress={() => void handleAsk(question)}
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <ActivityIndicator color={colors.accentForeground} size="small" />
              ) : (
                <Text style={styles.askButtonText}>Ask</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {answer ? (
            <View style={styles.answerCard}>
              <Text style={styles.answer}>{answer}</Text>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.md,
      gap: Spacing.sm,
      maxHeight: '75%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    chips: {
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    chip: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: {
      fontSize: FontSizes.sm,
      color: colors.text,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: FontSizes.md,
      color: colors.text,
      backgroundColor: colors.background,
    },
    askButton: {
      backgroundColor: colors.accent,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minWidth: 64,
      alignItems: 'center',
    },
    askButtonDisabled: {
      opacity: 0.6,
    },
    askButtonText: {
      color: colors.accentForeground,
      fontWeight: FontWeights.semibold,
      fontSize: FontSizes.sm,
    },
    error: {
      color: colors.error,
      fontSize: FontSizes.sm,
    },
    answerCard: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    answer: {
      fontSize: FontSizes.md,
      color: colors.text,
      lineHeight: 22,
    },
  });
}
