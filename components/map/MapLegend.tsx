import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '@/constants/theme';

export function MapLegend() {
  return (
    <View style={styles.legend} pointerEvents="none">
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
        <Text style={styles.legendText}>Your Location</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
        <Text style={styles.legendText}>Peak Season</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#111111' }]} />
        <Text style={styles.legendText}>Fishing Spot</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: FontWeights.medium,
  },
});

export const MAP_HEIGHT = 280;

export const mapContainerStyle = {
  width: '100%' as const,
  height: MAP_HEIGHT,
  borderRadius: BorderRadius.lg,
  overflow: 'hidden' as const,
  backgroundColor: Colors.cardLight,
};
