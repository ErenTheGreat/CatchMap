import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, type ViewProps } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface CollapsibleContentProps extends ViewProps {
  children: React.ReactNode;
  expanded: boolean;
  duration?: number;
}

/**
 * Height + opacity expand/collapse. Measures content once, then animates max-height.
 */
export default function CollapsibleContent({
  children,
  expanded,
  duration = 260,
  style,
  ...props
}: CollapsibleContentProps) {
  const reduceMotion = useReduceMotion();
  const [contentHeight, setContentHeight] = useState(0);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shouldMeasure = expanded || contentHeight > 0;
  const motionDuration = reduceMotion ? 0 : duration;

  useEffect(() => {
    if (contentHeight === 0) return;

    if (reduceMotion) {
      heightAnim.setValue(expanded ? contentHeight : 0);
      opacityAnim.setValue(expanded ? 1 : 0);
      return;
    }

    heightAnim.stopAnimation();
    opacityAnim.stopAnimation();

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: expanded ? contentHeight : 0,
        duration: motionDuration,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: expanded ? 1 : 0,
        duration: expanded ? motionDuration : Math.round(motionDuration * 0.75),
        // Must match heightAnim — both apply to the same Animated.View.
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    contentHeight,
    expanded,
    heightAnim,
    motionDuration,
    opacityAnim,
    reduceMotion,
  ]);

  if (reduceMotion) {
    if (!expanded) return null;

    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  }

  return (
    <>
      {shouldMeasure ? (
        <View
          style={{ position: 'absolute', opacity: 0, zIndex: -1, left: 0, right: 0 }}
          pointerEvents="none"
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && nextHeight !== contentHeight) {
              setContentHeight(nextHeight);
              if (expanded) {
                heightAnim.setValue(nextHeight);
                opacityAnim.setValue(1);
              }
            }
          }}
        >
          {children}
        </View>
      ) : null}
      <Animated.View
        style={[style, { height: heightAnim, overflow: 'hidden', opacity: opacityAnim }]}
        {...props}
      >
        {expanded ? children : null}
      </Animated.View>
    </>
  );
}
