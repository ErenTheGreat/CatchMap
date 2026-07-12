import { FishingSpot } from '@/lib/supabase';
import { calculateDistance } from '@/utils/geo';

export interface NearbySpot extends FishingSpot {
  distance: number;
  matchedSpecies: string[];
  isPeakSeason: boolean;
  /** Rich fields from the curated FishingDatabase dataset */
  avgDepthFeet?: number;
  underwaterStructure?: string[];
  bestSeason?: string;
  /** Distinguishes water bodies from access infrastructure on the map. */
  poiType?: 'water' | 'access_ramp' | 'marina';
}

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

export function getSpotName(tags: Record<string, string>): string {
  if (tags.name) return tags.name;
  if (tags['name:en']) return tags['name:en'];
  if (tags.operator) return tags.operator;

  if (tags.leisure === 'fishing') return 'Fishing Area';
  if (tags['man_made'] === 'pier') return 'Fishing Pier';
  if (tags.waterway) return `${tags.waterway.charAt(0).toUpperCase()}${tags.waterway.slice(1)} Fishing Spot`;
  return 'Fishing Spot';
}

export function inferWaterType(tags: Record<string, string>): string {
  if (tags.water === 'pond' || tags.natural === 'pond') return 'pond';
  if (tags.water === 'lake' || (tags.natural === 'water' && !tags.waterway)) return 'lake';
  if (tags.waterway === 'stream' || tags.natural === 'stream') return 'stream';
  if (tags.waterway === 'river' || tags.natural === 'river') return 'river';
  if (tags.natural === 'bay' || tags.place === 'bay') return 'bay';
  if (tags.natural === 'coastline' || tags['seamark:type']) return 'coastal';
  return 'lake';
}

export function inferFacilities(tags: Record<string, string>): string[] {
  const facilities: string[] = [];
  if (tags['man_made'] === 'pier') facilities.push('pier');
  if (tags.leisure === 'slipway' || tags['boat:launch'] === 'yes') facilities.push('boat_launch');
  if (tags.parking === 'yes' || tags['parking:lane'] === 'yes') facilities.push('parking');
  if (tags.toilets === 'yes' || tags.amenity === 'toilets') facilities.push('restrooms');
  return facilities;
}

function buildOverpassQuery(latitude: number, longitude: number, radiusMeters: number): string {
  return `
    [out:json][timeout:25];
    (
      node(around:${radiusMeters},${latitude},${longitude})["leisure"="fishing"];
      way(around:${radiusMeters},${latitude},${longitude})["leisure"="fishing"];
      relation(around:${radiusMeters},${latitude},${longitude})["leisure"="fishing"];
      node(around:${radiusMeters},${latitude},${longitude})["sport"="fishing"];
      node(around:${radiusMeters},${latitude},${longitude})["amenity"="fishing"];
      node(around:${radiusMeters},${latitude},${longitude})["man_made"="pier"]["fishing"="yes"];
      way(around:${radiusMeters},${latitude},${longitude})["man_made"="pier"]["fishing"="yes"];
      node(around:${radiusMeters},${latitude},${longitude})["man_made"="pier"]["leisure"="fishing"];
      node(around:${radiusMeters},${latitude},${longitude})["waterway"="fishing"];
      node(around:${radiusMeters},${latitude},${longitude})["leisure"="fishing_ground"];
    );
    out center 40;
  `;
}

export async function getOsmFishingSpots(
  latitude: number,
  longitude: number,
  radiusMiles: number = 50
): Promise<NearbySpot[]> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass rejects generic/absent User-Agents with 406 (ignored on web)
        'User-Agent': 'fishing-app/1.0',
      },
      body: `data=${encodeURIComponent(buildOverpassQuery(latitude, longitude, radiusMeters))}`,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429 || status === 504) {
        console.warn(`OSM fishing spots unavailable (HTTP ${status}), skipping remote fetch`);
        return [];
      }
      throw new Error(`Overpass API error: ${status}`);
    }

    const data: OverpassResponse = await response.json();
    const seen = new Set<string>();

    const spots: NearbySpot[] = [];

    for (const element of data.elements) {
      const coords = getElementCoords(element);
      if (!coords || !element.tags) continue;

      const key = `${coords.lat.toFixed(4)},${coords.lon.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const distance = calculateDistance(latitude, longitude, coords.lat, coords.lon);
      if (distance > radiusMiles) continue;

      const tags = element.tags;
      const waterType = inferWaterType(tags);

      const spot: NearbySpot = {
        id: `osm-${element.type}-${element.id}`,
        name: getSpotName(tags),
        description: tags.description || tags.note || tags['fishing:type'] || null,
        latitude: coords.lat,
        longitude: coords.lon,
        water_type: waterType,
        species: [],
        facilities: inferFacilities(tags),
        best_months: [],
        rating: tags['fishing:rating'] ? parseFloat(tags['fishing:rating']) : 4.0,
        created_at: new Date().toISOString(),
        distance: Math.round(distance * 10) / 10,
        matchedSpecies: [],
        isPeakSeason: false,
      };

      spots.push(spot);
    }

    return spots
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/429|504|rate.?limit|timeout/i.test(message)) {
      console.warn('OSM fishing spots unavailable (rate limit/timeout), skipping remote fetch');
    } else {
      console.error('Error fetching OSM fishing spots:', error);
    }
    return [];
  }
}

export function mergeFishingSpots(
  primary: NearbySpot[],
  fallback: NearbySpot[],
  maxResults: number = 15
): NearbySpot[] {
  const merged = [...primary];

  for (const spot of fallback) {
    const isDuplicate = merged.some(
      (existing) =>
        calculateDistance(existing.latitude, existing.longitude, spot.latitude, spot.longitude) < 0.3
    );
    if (!isDuplicate) {
      merged.push(spot);
    }
  }

  return merged.sort((a, b) => a.distance - b.distance).slice(0, maxResults);
}
