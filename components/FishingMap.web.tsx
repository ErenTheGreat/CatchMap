import React from 'react';
import FishingMapVector from '@/components/map/FishingMapVector';
import type { FishingMapProps } from '@/components/map/types';

/**
 * Web entry — MapLibre GL JS via iframe. No native TurboModules are loaded.
 */
export default function FishingMap(props: FishingMapProps) {
  return <FishingMapVector {...props} />;
}

export type { FishingMapProps };
