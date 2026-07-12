import type { FlyToTarget } from '@/components/map/types';

export interface MapFlyCommand {
  lng: number;
  lat: number;
  zoom?: number;
}

export function toFlyCommand(target: FlyToTarget | MapFlyCommand): MapFlyCommand {
  return {
    lng: target.lng,
    lat: target.lat,
    zoom: 'zoom' in target ? target.zoom : undefined,
  };
}
