import type { ActiveCoordinates, DeviceLocation } from '@/lib/types/mapCoordinates';
import type { NearbySpot } from '@/utils/recommendations';

export interface CatchLocation {
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  waterType?: string | null;
  loading?: boolean;
}

export function resolveCatchLocationFromMap(
  selectedSpot: NearbySpot | null | undefined,
  activeCoords: ActiveCoordinates | null | undefined
): CatchLocation {
  if (selectedSpot) {
    return {
      latitude: selectedSpot.latitude,
      longitude: selectedSpot.longitude,
      locationName: selectedSpot.name,
      waterType: selectedSpot.water_type,
    };
  }

  if (activeCoords) {
    return {
      latitude: activeCoords.latitude,
      longitude: activeCoords.longitude,
      locationName: activeCoords.label ?? 'Current location',
    };
  }

  return { latitude: null, longitude: null, locationName: null };
}

export function resolveCatchLocationFromDevice(
  deviceLocation: DeviceLocation | null | undefined,
  loading?: boolean
): CatchLocation {
  if (loading) {
    return { latitude: null, longitude: null, locationName: null, loading: true };
  }

  if (!deviceLocation || deviceLocation.permissionDenied || deviceLocation.isDefault) {
    return { latitude: null, longitude: null, locationName: null };
  }

  return {
    latitude: deviceLocation.latitude,
    longitude: deviceLocation.longitude,
    locationName: 'Current location',
  };
}

export function formatCatchLocationLabel(location: CatchLocation): {
  title: string;
  subtitle: string | null;
  hasLocation: boolean;
} {
  if (location.loading) {
    return { title: 'Detecting location…', subtitle: null, hasLocation: false };
  }

  const hasCoords = location.latitude != null && location.longitude != null;
  if (!hasCoords) {
    return {
      title: 'No location saved',
      subtitle: 'Enable GPS to link this catch to the map and spot insights.',
      hasLocation: false,
    };
  }

  const coords = `${location.latitude!.toFixed(4)}°, ${location.longitude!.toFixed(4)}°`;
  if (location.locationName) {
    return {
      title: location.locationName,
      subtitle: coords,
      hasLocation: true,
    };
  }

  return {
    title: coords,
    subtitle: null,
    hasLocation: true,
  };
}
