import React from 'react';
import { Platform } from 'react-native';
import FishingMapVector from '@/components/map/FishingMapVector';
import type { FishingMapProps } from '@/components/map/types';

let NativeMapAvailable = false;
let FishingMapMapLibreNative: React.ComponentType<FishingMapProps> | null = null;

if (Platform.OS !== 'web') {
  try {
    // Native MapLibre module exists only in dev builds, not Expo Go
    const { Map: NativeMap } = require('@maplibre/maplibre-react-native');
    if (NativeMap) {
      FishingMapMapLibreNative =
        require('@/components/map/FishingMapMapLibreNative.native').default;
      NativeMapAvailable = true;
    }
  } catch {
    NativeMapAvailable = false;
  }
}

/**
 * Map router (iOS / Android):
 * - Native MapLibre (vector tiles, GPU clustering) in dev builds
 * - MapLibre GL JS in WebView for Expo Go
 *
 * Web uses FishingMap.web.tsx so native modules are never bundled.
 */
export default function FishingMap(props: FishingMapProps) {
  if (Platform.OS === 'web') {
    return <FishingMapVector {...props} />;
  }

  if (NativeMapAvailable && FishingMapMapLibreNative) {
    return <FishingMapMapLibreNative {...props} />;
  }

  return <FishingMapVector {...props} />;
}

export type { FishingMapProps };
