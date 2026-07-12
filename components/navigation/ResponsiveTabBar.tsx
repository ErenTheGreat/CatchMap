import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { SIDE_TAB_BAR_WIDTH } from '@/constants/layout';
import { FontSizes, FontWeights, Spacing, FontFamily } from '@/constants/theme';
import BrandMark from '@/components/brand/BrandMark';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { isCatchAiTabVisible } from '@/constants/features';
import { useLogFormGuard } from '@/providers/LogFormGuardProvider';
import { useFontsReady } from '@/providers/FontProvider';
import { useTheme } from '@/providers/ThemeProvider';

export default function ResponsiveTabBar(props: BottomTabBarProps) {
  const { useSideTabs } = useResponsiveLayout();
  const { colors } = useTheme();
  const fontsReady = useFontsReady();

  const { isDirty, confirmLeave } = useLogFormGuard();

  if (!useSideTabs) {
    return <BottomTabBar {...props} />;
  }

  return (
    <View
      style={[
        styles.sideBar,
        {
          width: SIDE_TAB_BAR_WIDTH,
          backgroundColor: colors.card,
          borderRightColor: colors.border,
        },
      ]}
    >
      <View style={styles.brandSlot}>
        <BrandMark size="sm" iconOnly />
        <Text style={[styles.brandLabel, { color: colors.brandNavy }, fontsReady && { fontFamily: FontFamily.brand }]}>
          CatchMap
        </Text>
      </View>
      {props.state.routes.map((route, index) => {
        const { options } = props.descriptors[route.key];
        if (route.name === 'assistant' && !isCatchAiTabVisible()) return null;

        const isFocused = props.state.index === index;
        const label = options.title ?? route.name;
        const color = isFocused ? colors.brandAccent : colors.textSecondary;

        const onPress = () => {
          if (isDirty) {
            confirmLeave(() => {
              const event = props.navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                props.navigation.navigate(route.name, route.params);
              }
            });
            return;
          }

          const event = props.navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            props.navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [
              styles.sideTab,
              isFocused && { backgroundColor: colors.cardLight },
              pressed && styles.sideTabPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={typeof label === 'string' ? label : route.name}
          >
            {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
            <Text style={[styles.sideTabLabel, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sideBar: {
    borderRightWidth: 1,
    paddingTop: Platform.OS === 'web' ? 16 : 8,
    paddingBottom: 16,
    justifyContent: 'flex-start',
    gap: 4,
  },
  brandSlot: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  brandLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  sideTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 6,
    gap: 4,
  },
  sideTabPressed: {
    opacity: 0.85,
  },
  sideTabLabel: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    textAlign: 'center',
  },
});
