import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface AnimatedChevronProps {
  expanded: boolean;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export default function AnimatedChevron({
  expanded,
  color,
  size = 20,
  style,
  duration = 220,
}: AnimatedChevronProps) {
  const reduceMotion = useReduceMotion();
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const motionDuration = reduceMotion ? 0 : duration;

  useEffect(() => {
    if (reduceMotion) {
      rotation.setValue(expanded ? 1 : 0);
      return;
    }

    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: motionDuration,
      useNativeDriver: true,
    }).start();
  }, [expanded, motionDuration, reduceMotion, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  if (reduceMotion) {
    return (
      <Animated.View
        style={[style, { transform: [{ rotate: expanded ? '90deg' : '0deg' }] }]}
      >
        <ChevronRight color={color} size={size} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>
      <ChevronRight color={color} size={size} />
    </Animated.View>
  );
}
