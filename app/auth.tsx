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
import { ChevronLeft, CloudUpload, Lock, ShieldCheck } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button, TextField, useToast } from '@/components/ui';
import BrandMark from '@/components/brand/BrandMark';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { hapticSuccess, hapticError } from '@/utils/haptics';

type Mode = 'signIn' | 'signUp';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { showToast } = useToast();
  const { signIn, signUp, resetPassword, updatePassword, recoveryMode, clearRecoveryMode } =
    useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [showReset, setShowReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === 'signUp';

  const validate = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!recoveryMode && !EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address';
    }
    if ((!showReset || recoveryMode) && password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      if (recoveryMode) {
        const result = await updatePassword(password);
        if (result.error) {
          hapticError();
          showToast({ message: result.error, variant: 'error' });
          return;
        }
        hapticSuccess();
        showToast({ message: 'Password updated — you are signed in', variant: 'success' });
        router.back();
        return;
      }

      if (showReset) {
        const result = await resetPassword(email);
        if (result.error) {
          hapticError();
          showToast({ message: result.error, variant: 'error' });
          return;
        }
        hapticSuccess();
        showToast({
          message: 'Password reset email sent — check your inbox',
          variant: 'success',
        });
        setShowReset(false);
        return;
      }

      const result = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password);

      if (result.error) {
        hapticError();
        showToast({ message: result.error, variant: 'error' });
        return;
      }

      if (isSignUp && result.needsEmailConfirmation) {
        hapticSuccess();
        showToast({
          message: 'Check your email to confirm your account, then sign in',
          variant: 'success',
        });
        setMode('signIn');
        return;
      }

      hapticSuccess();
      showToast({
        message: isSignUp
          ? 'Account created — your catches now back up automatically'
          : 'Signed in — your catches now back up automatically',
        variant: 'success',
      });
      router.back();
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
        <Text style={styles.headerTitle}>
          {recoveryMode
            ? 'Set New Password'
            : showReset
              ? 'Reset Password'
              : isSignUp
                ? 'Create Account'
                : 'Sign In'}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.benefitsCard}>
            <View style={styles.benefitRow}>
              <CloudUpload color={colors.accent} size={18} />
              <Text style={styles.benefitText}>
                Back up your catch log and photos so they survive reinstalls
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <Lock color={colors.accent} size={18} />
              <Text style={styles.benefitText}>
                Your catches stay private by default — only you can see them
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <ShieldCheck color={colors.accent} size={18} />
              <Text style={styles.benefitText}>
                Optionally contribute anonymized catch data to improve bite forecasts for
                everyone — your exact spots are never shown
              </Text>
            </View>
          </View>

          {!showReset && !recoveryMode ? (
          <TextField
            label="Email"
            required
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            error={errors.email}
          />
          ) : null}

          {!showReset || recoveryMode ? (
          <TextField
            label="Password"
            required
            placeholder={
              recoveryMode
                ? 'At least 6 characters'
                : isSignUp
                  ? 'At least 6 characters'
                  : 'Your password'
            }
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={recoveryMode || isSignUp ? 'new-password' : 'current-password'}
            error={errors.password}
          />
          ) : null}

          <Button
            title={
              recoveryMode
                ? 'Update Password'
                : showReset
                  ? 'Send Reset Email'
                  : isSignUp
                    ? 'Create Account'
                    : 'Sign In'
            }
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
            accessibilityLabel={
              recoveryMode
                ? 'Update password'
                : showReset
                  ? 'Send password reset email'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'
            }
          />

          {!recoveryMode && !isSignUp && !showReset ? (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => {
                setShowReset(true);
                setErrors({});
              }}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          ) : null}

          {recoveryMode ? (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => {
                clearRecoveryMode();
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel password reset"
            >
              <Text style={styles.switchModeText}>Cancel</Text>
            </TouchableOpacity>
          ) : showReset ? (
            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setShowReset(false)}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.switchModeText}>Back to sign in</Text>
            </TouchableOpacity>
          ) : (
          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => {
              setMode(isSignUp ? 'signIn' : 'signUp');
              setErrors({});
            }}
            accessibilityRole="button"
            accessibilityLabel={
              isSignUp ? 'Switch to sign in' : 'Switch to create account'
            }
          >
            <Text style={styles.switchModeText}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </Text>
          </TouchableOpacity>
          )}

          <View style={styles.bottomPadding} />
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
    flex: {
      flex: 1,
    },
    brandRow: {
      alignItems: 'center',
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
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
    benefitsCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    benefitText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    submitButton: {
      marginTop: Spacing.sm,
    },
    switchModeButton: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.sm,
    },
    switchModeText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    forgotPasswordButton: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    forgotPasswordText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    bottomPadding: {
      height: Spacing.xxl,
    },
  });
}
