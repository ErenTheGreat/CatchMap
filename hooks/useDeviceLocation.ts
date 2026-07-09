import { useQuery } from '@tanstack/react-query';
import { getCurrentLocation } from '@/utils/location';
import type { DeviceLocation } from '@/lib/types/mapCoordinates';

const FALLBACK_LOCATION = {
  latitude: 45.5231,
  longitude: -122.6765,
};

async function resolveDeviceLocation(): Promise<DeviceLocation> {
  try {
    const coords = await getCurrentLocation();
    if (coords) {
      return {
        ...coords,
        isDefault: false,
        permissionDenied: false,
      };
    }
    return {
      ...FALLBACK_LOCATION,
      isDefault: true,
      permissionDenied: true,
    };
  } catch {
    return {
      ...FALLBACK_LOCATION,
      isDefault: true,
      permissionDenied: true,
    };
  }
}

export function useDeviceLocation() {
  return useQuery({
    queryKey: ['deviceLocation'],
    queryFn: resolveDeviceLocation,
    staleTime: 2 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
