import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Send, Trash2, AlertTriangle } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import CatchAiSetupCard from '@/components/ai/CatchAiSetupCard';
import type { ChatMessage } from '@/hooks/useCatchAi';
import type { UsageStatus } from '@/lib/ai/usageTracker';
import { getSuggestedChatPrompts } from '@/lib/ai/contextBuilder';

interface CatchAiChatProps {
  messages: ChatMessage[];
  sending: boolean;
  hasKey: boolean;
  usage: {
    status: UsageStatus;
    count: number;
    budget: number;
    remaining: number;
    percentUsed: number;
  };
  onSend: (text: string) => Promise<void>;
  onClear: () => void;
  onSaveKey: (key: string) => Promise<void>;
  onTestKey: (key: string) => Promise<boolean>;
  speciesName?: string | null;
  error?: string | null;
}

export default function CatchAiChat({
  messages,
  sending,
  hasKey,
  usage,
  onSend,
  onClear,
  onSaveKey,
  onTestKey,
  speciesName,
  error,
}: CatchAiChatProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const prompts = getSuggestedChatPrompts(speciesName);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    await onSend(msg);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  if (!hasKey) {
    return (
      <CatchAiSetupCard
        onSaveKey={onSaveKey}
        onTestKey={onTestKey}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {usage.status !== 'ok' ? (
        <View
          style={[
            styles.usageBanner,
            usage.status === 'exceeded' ? styles.usageExceeded : styles.usageWarning,
          ]}
        >
          <AlertTriangle
            color={usage.status === 'exceeded' ? colors.error : colors.warning}
            size={16}
          />
          <Text style={styles.usageText}>
            {usage.status === 'exceeded'
              ? `Daily budget reached (${usage.count}/${usage.budget}). Heuristics still work — try tomorrow.`
              : `Approaching daily budget: ${usage.count}/${usage.budget} requests used.`}
          </Text>
        </View>
      ) : (
        <Text style={styles.usageHint}>
          {usage.remaining} of {usage.budget} AI requests left today
        </Text>
      )}

      {messages.length === 0 ? (
        <View style={styles.prompts}>
          <Text style={styles.promptsTitle}>Try asking:</Text>
          {prompts.map((prompt) => (
            <TouchableOpacity
              key={prompt}
              style={styles.promptChip}
              onPress={() => handleSend(prompt)}
              disabled={sending || usage.status === 'exceeded'}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' ? styles.userText : styles.assistantText,
                ]}
              >
                {item.content}
              </Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputRow}>
        <TouchableOpacity
          onPress={onClear}
          style={styles.clearButton}
          accessibilityLabel="Clear chat history"
        >
          <Trash2 color={colors.textMuted} size={18} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Ask about rigs, conditions, species…"
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!sending && usage.status !== 'exceeded'}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || sending || usage.status === 'exceeded') && styles.sendDisabled,
          ]}
          onPress={() => handleSend()}
          disabled={!input.trim() || sending || usage.status === 'exceeded'}
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color={colors.accentForeground} size="small" />
          ) : (
            <Send color={colors.accentForeground} size={18} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerNote}>
        Each message uses 1 request from your Google free tier. CatchMap never charges you.
      </Text>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    usageBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    usageWarning: {
      backgroundColor: colors.warningSurface,
    },
    usageExceeded: {
      backgroundColor: colors.errorSurface ?? colors.warningSurface,
    },
    usageText: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.xs,
    },
    usageHint: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginBottom: Spacing.sm,
    },
    prompts: {
      flex: 1,
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    promptsTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    promptChip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
    },
    messageList: {
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    bubble: {
      maxWidth: '85%',
      borderRadius: BorderRadius.lg,
      padding: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.accent,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: {
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    userText: {
      color: colors.accentForeground,
    },
    assistantText: {
      color: colors.text,
    },
    errorText: {
      color: colors.error,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.xs,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.sm,
    },
    clearButton: {
      padding: Spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      color: colors.text,
      fontSize: FontSizes.sm,
    },
    sendButton: {
      backgroundColor: colors.accent,
      borderRadius: BorderRadius.full,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendDisabled: {
      opacity: 0.5,
    },
    footerNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
  });
}
