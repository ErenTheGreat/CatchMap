export interface SpotMapsUrlOptions {
  latitude: number;
  longitude: number;
  name?: string;
}

export function buildSpotMapsUrls({
  latitude,
  longitude,
  name,
}: SpotMapsUrlOptions) {
  const label = encodeURIComponent(name?.trim() || 'Fishing spot');
  const coords = `${latitude},${longitude}`;

  return {
    appleDirections: `http://maps.apple.com/?daddr=${coords}&dirflg=d`,
    googleNavigation: `google.navigation:q=${coords}`,
    googleUniversal: `https://www.google.com/maps/dir/?api=1&destination=${coords}&destination_place_id=&travelmode=driving`,
    googleSearch: `https://www.google.com/maps/search/?api=1&query=${coords}(${label})`,
  };
}
