import React from 'react';
import { Tabs } from 'expo-router';
import { MapPin, Fish, BookOpen, History, Sparkles } from 'lucide-react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import ResponsiveTabBar from '@/components/navigation/ResponsiveTabBar';
import { SIDE_TAB_BAR_WIDTH } from '@/constants/layout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { isCatchAiTabVisible } from '@/constants/features';
import { useLogFormGuard } from '@/providers/LogFormGuardProvider';
import { useTheme } from '@/providers/ThemeProvider';

function GuardedTabBarButton(props: BottomTabBarButtonProps) {
  const { isDirty, confirmLeave } = useLogFormGuard();

  return (
    <PlatformPressable
      {...props}
      onPress={(event) => {
        if (isDirty) {
          confirmLeave(() => props.onPress?.(event));
          return;
        }

        props.onPress?.(event);
      }}
    />
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { useSideTabs } = useResponsiveLayout();

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarButton: useSideTabs
          ? undefined
          : (props) => <GuardedTabBarButton {...props} />,
        sceneStyle: useSideTabs ? { marginLeft: SIDE_TAB_BAR_WIDTH } : undefined,
        tabBarStyle: useSideTabs
          ? {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: SIDE_TAB_BAR_WIDTH,
              height: '100%',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
            }
          : {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              height: 65,
              paddingBottom: 12,
              paddingTop: 8,
            },
        tabBarActiveTintColor: colors.brandAccent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <MapPin color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log Catch',
          tabBarIcon: ({ color, size }) => (
            <Fish color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="species"
        options={{
          title: 'Species',
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <History color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: 'Catch AI',
          href: isCatchAiTabVisible() ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Sparkles color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
