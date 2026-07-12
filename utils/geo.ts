export type Region =
  | 'northwest'
  | 'northeast'
  | 'southwest'
  | 'southeast'
  | 'midwest'
  | 'south'
  | 'west';

export function getRegionFromCoordinates(lat: number, lon: number): Region[] {
  if (lat >= 40 && lon <= -100) return ['northwest', 'west'];
  if (lat >= 40 && lon > -100) return ['northeast', 'midwest'];
  if (lat >= 32 && lat < 40 && lon <= -100) return ['southwest', 'west'];
  if (lat >= 32 && lat < 40 && lon > -100) return ['southeast', 'south'];
  if (lat < 32 && lon <= -95) return ['south', 'southwest'];
  if (lat < 32 && lon > -95) return ['south', 'southeast'];
  return ['midwest'];
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
