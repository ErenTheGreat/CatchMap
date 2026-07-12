import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, TextField, useToast, SegmentedControl } from '@/components/ui';
import BrandMark from '@/components/brand/BrandMark';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import {
  submitFeedback,
  type FeedbackCategory,
} from '@/lib/api/feedbackApi';

const CATEGORY_OPTIONS: { id: FeedbackCategory; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature' },
  { id: 'general', label: 'General' },
];

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { showToast } = useToast();

  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [messageError, setMessageError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      setMessageError('Please enter at least 10 characters.');
      return;
    }

    setMessageError(undefined);
    setSubmitting(true);

    try {
      const result = await submitFeedback({
        category,
        message: trimmed,
        contactEmail: contactEmail.trim() || undefined,
      });

      hapticSuccess();
      if (result.method === 'supabase') {
        showToast({ message: 'Thanks — your feedback was sent!', variant: 'success' });
        router.back();
        return;
      }

      if (result.method === 'email') {
        showToast({
          message: 'Email draft opened — tap Send to deliver your feedback',
          variant: 'success',
        });
        router.back();
        return;
      }

      showToast({
        message: 'Share sheet opened — send feedback via your chosen app',
        variant: 'success',
      });
      router.back();
    } catch (error) {
      hapticError();
      const msg = error instanceof Error ? error.message : 'Could not send feedback';
      showToast({ message: msg, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send feedback</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <MessageSquare color={colors.accent} size={22} />
            <Text style={styles.introTitle}>Help us improve CatchMap</Text>
            <Text style={styles.introText}>
              Report bugs, suggest features, or share anything that would make CatchMap better.
              Optional email lets us follow up with you.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.card}>
            <SegmentedControl
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              accessibilityLabel="Feedback category"
            />
          </View>

          <Text style={styles.sectionLabel}>Your feedback</Text>
          <View style={styles.card}>
            <TextField
              label="Message"
              required
              value={message}
              onChangeText={(text) => {
                setMessage(text);
                if (messageError && text.trim().length >= 10) {
                  setMessageError(undefined);
                }
              }}
              placeholder="What happened? What would you like to see improved?"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              style={styles.messageInput}
              error={messageError}
            />
            <TextField
              label="Email (optional)"
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Button
            title="Send feedback"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    brandRow: {
      alignItems: 'center',
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    scrollContent: {
      paddingBottom: Spacing.xxl,
    },
    introCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    introTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    introText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    messageInput: {
      minHeight: 140,
    },
    submitButton: {
      marginTop: Spacing.lg,
    },
  });
}
