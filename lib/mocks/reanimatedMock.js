'use strict';

const { Animated: RNAnimated, processColor } = require('react-native');

// Standalone stub for dev clients without react-native-reanimated / worklets native code.
// The package mock still requires ./src/index and triggers installTurboModule().

const NOOP = () => {};
const NOOP_FACTORY = () => NOOP;
const ID = (value) => value;

const Extrapolation = {
  CLAMP: 'clamp',
  EXTEND: 'extend',
  IDENTITY: 'identity',
};

const Animated = {
  ...RNAnimated,
  View: RNAnimated.View,
  Text: RNAnimated.Text,
  Image: RNAnimated.Image,
  ScrollView: RNAnimated.ScrollView,
  createAnimatedComponent: (Component) => Component,
};

const hooks = {
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (factory) => factory(),
  useAnimatedProps: (factory) => factory(),
  useDerivedValue: (factory) => ({ value: factory() }),
  useAnimatedRef: () => ({ current: null }),
  useAnimatedReaction: NOOP,
  useAnimatedScrollHandler: NOOP_FACTORY,
  useAnimatedKeyboard: () => ({ height: 0, state: 0 }),
  useScrollViewOffset: () => ({ value: 0 }),
  useScrollOffset: () => ({ value: 0 }),
  useEvent: () => NOOP,
};

const animations = {
  withTiming: (value) => value,
  withSpring: (value) => value,
  withDecay: () => 0,
  withDelay: (_delay, next) => next,
  withRepeat: ID,
  withSequence: () => 0,
  cancelAnimation: NOOP,
};

module.exports = {
  ...hooks,
  ...animations,
  default: Animated,
  Animated,
  Extrapolation,
  ColorSpace: { RGB: 'rgb', HSL: 'hsl' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  interpolate: NOOP,
  clamp: NOOP,
  measure: () => ({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 }),
  scrollTo: NOOP,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  processColor,
  setGestureState: NOOP,
  createAnimatedComponent: Animated.createAnimatedComponent,
  Easing: {
    linear: ID,
    ease: ID,
    in: ID,
    out: ID,
    inOut: ID,
  },
};
