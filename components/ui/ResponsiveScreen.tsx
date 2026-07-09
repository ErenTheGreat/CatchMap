import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** When true, content stretches to the full viewport width on wide screens. */
  fullWidth?: boolean;
}

/**
 * Centers primary content on tablet/web with a readable max width.
 * Phone layouts pass through unchanged.
 */
export default function ResponsiveScreen({
  children,
  style,
  fullWidth = false,
}: ResponsiveScreenProps) {
  const { isWide, contentMaxWidth } = useResponsiveLayout();

  return (
    <View style={[styles.outer, style]}>
      <View
        style={[
          styles.inner,
          isWide && !fullWidth && { maxWidth: contentMaxWidth, alignSelf: 'center' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
});
