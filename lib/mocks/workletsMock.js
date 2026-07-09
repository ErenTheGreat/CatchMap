'use strict';

// Stub for dev clients built without react-native-worklets native code.
// gesture-handler / reanimated pull this in at module load; without a mock
// installTurboModule() crashes before the Map tab can register.

module.exports = {
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  createSerializable: (value) => value,
  isWorkletFunction: () => false,
};
