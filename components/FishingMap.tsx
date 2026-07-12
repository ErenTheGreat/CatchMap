import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import FishingMapVector from '@/components/map/FishingMapVector';
import type { FishingMapProps } from '@/components/map/types';

type NativeMapComponent = React.ComponentType<FishingMapProps>;

let cachedNativeMapComponent: NativeMapComponent | null | undefined;
let nativeMapPermanentlyDisabled = false;

function isNativeMapRegistrationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /MLRNCamera|register two views with the same name/i.test(error.message);
}

function disableNativeMap(reason: Error) {
  nativeMapPermanentlyDisabled = true;
  cachedNativeMapComponent = null;
  console.warn('[FishingMap] Disabling native MapLibre for this session:', reason.message);
}

function getNativeMapComponent(): NativeMapComponent | null {
  if (Platform.OS === 'web') return null;
  // Release APKs cannot recover from MapLibre's duplicate-view Invariant Violation — RN kills
  // the process before our error boundary runs. Use the WebView map instead.
  if (!__DEV__) return null;
  if (nativeMapPermanentlyDisabled) return null;
  if (cachedNativeMapComponent !== undefined) return cachedNativeMapComponent;

  try {
    // Single require — loading @maplibre/maplibre-react-native twice registers MLRNCamera twice.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const component = require('@/components/map/FishingMapMapLibreNative.native')
      .default as NativeMapComponent | undefined;
    cachedNativeMapComponent = component ?? null;
    return cachedNativeMapComponent;
  } catch (error) {
    if (isNativeMapRegistrationError(error)) {
      disableNativeMap(error instanceof Error ? error : new Error(String(error)));
    }
  }

  cachedNativeMapComponent = null;
  return null;
}

class NativeMapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isNativeMapRegistrationError(error)) {
      disableNativeMap(error);
    }
    console.warn('[FishingMap] Native MapLibre failed, using vector fallback:', error, info);
  }

  render() {
    if (this.state.hasError || nativeMapPermanentlyDisabled) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Map router (iOS / Android):
 * - Native MapLibre (vector tiles, GPU clustering) in dev builds
 * - MapLibre GL JS in WebView for Expo Go or when native init fails
 *
 * Web uses FishingMap.web.tsx so native modules are never bundled.
 */
export default function FishingMap(props: FishingMapProps) {
  if (Platform.OS === 'web') {
    return <FishingMapVector {...props} />;
  }

  const NativeMap = getNativeMapComponent();
  if (!NativeMap || nativeMapPermanentlyDisabled) {
    return <FishingMapVector {...props} />;
  }

  const vectorFallback = <FishingMapVector {...props} />;

  return (
    <NativeMapErrorBoundary fallback={vectorFallback}>
      <NativeMap {...props} />
    </NativeMapErrorBoundary>
  );
}

export type { FishingMapProps };
