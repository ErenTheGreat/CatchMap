import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { getSheetHeightForIndex } from '@/components/map/mapSheetConstants';

export interface MapNativeSheetHandle {
  snapToIndex: (index: number) => void;
}

interface MapNativeSheetProps {
  snapPointCount?: number;
  topInset?: number;
  onChange?: (index: number) => void;
  backgroundStyle?: StyleProp<ViewStyle>;
  handleIndicatorStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const MapNativeSheet = forwardRef<MapNativeSheetHandle, MapNativeSheetProps>(function MapNativeSheet(
  {
    snapPointCount = 3,
    topInset = 0,
    onChange,
    backgroundStyle,
    handleIndicatorStyle,
    contentContainerStyle,
    children,
  },
  ref
) {
  const { height: windowHeight } = useWindowDimensions();
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheetIndexRef = useRef(0);
  const initialHeight = getSheetHeightForIndex(0, windowHeight, topInset);
  const startHeightRef = useRef(initialHeight);
  const animatedHeight = useRef(new Animated.Value(initialHeight)).current;

  const snapHeights = useMemo(
    () =>
      Array.from({ length: snapPointCount }, (_, index) =>
        getSheetHeightForIndex(index, windowHeight, topInset)
      ),
    [snapPointCount, windowHeight, topInset]
  );

  const snapToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, snapPointCount - 1));
      sheetIndexRef.current = clamped;
      setSheetIndex(clamped);
      onChange?.(clamped);
      Animated.spring(animatedHeight, {
        toValue: snapHeights[clamped],
        useNativeDriver: false,
        damping: 24,
        stiffness: 280,
      }).start();
    },
    [animatedHeight, onChange, snapHeights, snapPointCount]
  );

  useImperativeHandle(ref, () => ({ snapToIndex }), [snapToIndex]);

  useEffect(() => {
    animatedHeight.setValue(snapHeights[sheetIndexRef.current]);
  }, [animatedHeight, snapHeights]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          animatedHeight.stopAnimation((value) => {
            startHeightRef.current =
              typeof value === 'number' ? value : snapHeights[sheetIndexRef.current];
          });
        },
        onPanResponderMove: (_, gesture) => {
          const minHeight = snapHeights[0];
          const maxHeight = snapHeights[snapHeights.length - 1];
          const next = Math.max(
            minHeight,
            Math.min(maxHeight, startHeightRef.current - gesture.dy)
          );
          animatedHeight.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const current = startHeightRef.current - gesture.dy;
          let nearest = 0;
          let minDistance = Number.POSITIVE_INFINITY;
          snapHeights.forEach((height, index) => {
            const distance = Math.abs(height - current);
            if (distance < minDistance) {
              minDistance = distance;
              nearest = index;
            }
          });
          if (gesture.vy < -0.45 && nearest < snapPointCount - 1) {
            nearest += 1;
          } else if (gesture.vy > 0.45 && nearest > 0) {
            nearest -= 1;
          }
          snapToIndex(nearest);
        },
      }),
    [animatedHeight, snapHeights, snapPointCount, snapToIndex]
  );

  const scrollEnabled = sheetIndex >= 1;
  const bodyDragHandlers = sheetIndex === 0 ? panResponder.panHandlers : undefined;

  return (
    <Animated.View
      style={[
        styles.sheet,
        { height: animatedHeight },
        backgroundStyle,
      ]}
      {...bodyDragHandlers}
    >
      <View style={styles.handleArea} {...panResponder.panHandlers}>
        <View style={[styles.handle, handleIndicatorStyle]} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={scrollEnabled}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        bounces={scrollEnabled}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
  },
  handleArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
});

export default MapNativeSheet;
