import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { calculateDistance } from '@/utils/geo';
import type { NearbySpot } from '@/utils/osmFishingSpots';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

function getElementCoords(element: OverpassElement): { lat: number; lon: number } | null {
  if (element.lat != null && element.lon != null) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function buildAccessOverpassQuery(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return `
    [out:json][timeout:25];
    (
      node["leisure"="slipway"](${minLat},${minLng},${maxLat},${maxLng});
      way["leisure"="slipway"](${minLat},${minLng},${maxLat},${maxLng});
      node["amenity"="boat_rental"](${minLat},${minLng},${maxLat},${maxLng});
      node["seamark:type"="harbour"](${minLat},${minLng},${maxLat},${maxLng});
      node["man_made"="pier"]["boat:launch"="yes"](${minLat},${minLng},${maxLat},${maxLng});
      node["leisure"="marina"](${minLat},${minLng},${maxLat},${maxLng});
      way["leisure"="marina"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center 40;
  `;
}

function getAccessName(tags: Record<string, string>): string {
  if (tags.name) return tags.name;
  if (tags['name:en']) return tags['name:en'];
  if (tags.leisure === 'slipway') return 'Boat Ramp';
  if (tags.leisure === 'marina') return 'Marina';
  if (tags['seamark:type'] === 'harbour') return 'Harbour';
  if (tags.amenity === 'boat_rental') return 'Boat Rental';
  return 'Boat Access';
}

function getAccessPoiType(tags: Record<string, string>): 'access_ramp' | 'marina' {
  if (tags.leisure === 'marina' || tags['seamark:type'] === 'harbour') {
    return 'marina';
  }
  return 'access_ramp';
}

function elementToAccessSpot(
  element: OverpassElement,
  centerLat: number,
  centerLng: number
): NearbySpot | null {
  const coords = getElementCoords(element);
  if (!coords) return null;

  const tags = element.tags ?? {};
  const poiType = getAccessPoiType(tags);
  const distance = calculateDistance(centerLat, centerLng, coords.lat, coords.lon);

  return {
    id: `access-${element.type}-${element.id}`,
    name: getAccessName(tags),
    description: poiType === 'marina' ? 'Marina / harbour access' : 'Boat launch or ramp',
    latitude: coords.lat,
    longitude: coords.lon,
    water_type: poiType === 'marina' ? 'marina' : 'boat_ramp',
    species: [],
    facilities: ['boat_launch'],
    best_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    rating: 4,
    created_at: new Date().toISOString(),
    distance,
    matchedSpecies: [],
    isPeakSeason: true,
    poiType,
  };
}

export async function fetchAccessPointsInBBox(
  bbox: BBox,
  centerLat: number,
  centerLng: number,
  signal?: AbortSignal
): Promise<NearbySpot[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildAccessOverpassQuery(bbox))}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass access POI query failed: ${response.status}`);
  }

  const payload = (await response.json()) as OverpassResponse;
  const spots: NearbySpot[] = [];

  for (const element of payload.elements ?? []) {
    const spot = elementToAccessSpot(element, centerLat, centerLng);
    if (spot) spots.push(spot);
  }

  return spots.sort((left, right) => left.distance - right.distance);
}
