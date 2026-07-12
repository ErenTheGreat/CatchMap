import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

export type ToastVariant = 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const variantColors = useMemo<Record<ToastVariant, string>>(
    () => ({
      success: colors.toastSuccess,
      warning: colors.toastWarning,
      error: colors.toastError,
    }),
    [colors]
  );

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    ({ message, variant = 'success', duration, actionLabel, onAction }: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const resolvedDuration = duration ?? (actionLabel ? 5000 : 3000);
      setToast({ message, variant, duration: resolvedDuration, actionLabel, onAction });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      hideTimer.current = setTimeout(hideToast, resolvedDuration);
    },
    [hideToast, opacity, translateY]
  );

  const handleAction = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    toast?.onAction?.();
    hideToast();
  }, [toast, hideToast]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            {
              top: insets.top + Spacing.md,
              backgroundColor: variantColors[toast.variant ?? 'success'],
              opacity,
              transform: [{ translateY }],
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastText}>{toast.message}</Text>
          {toast.actionLabel && toast.onAction ? (
            <Pressable
              onPress={handleAction}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={toast.actionLabel}
            >
              <Text style={styles.actionText}>{toast.actionLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      left: Spacing.md,
      right: Spacing.md,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      zIndex: 9999,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    toastText: {
      color: colors.accentForeground,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      textAlign: 'center',
    },
    actionButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    actionText: {
      color: colors.accentForeground,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
  });
}
