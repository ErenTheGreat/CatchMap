import React, { useEffect, useRef } from 'react';
import { Animated, type ViewProps } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface FadeInViewProps extends ViewProps {
  children: React.ReactNode;
  /** Stagger delay in ms (e.g. list index × 40). */
  delay?: number;
  duration?: number;
  /** Vertical slide distance in px. */
  offsetY?: number;
}

export default function FadeInView({
  children,
  delay = 0,
  duration = 280,
  offsetY = 8,
  style,
  ...props
}: FadeInViewProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : offsetY)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(offsetY);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, duration, offsetY, opacity, reduceMotion, translateY]);

  if (reduceMotion) {
    return (
      <Animated.View style={style} {...props}>
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]} {...props}>
      {children}
    </Animated.View>
  );
}
