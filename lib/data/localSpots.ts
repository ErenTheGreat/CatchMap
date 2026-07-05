import fishingData, { FishingSpotRecord } from '@/data/FishingDatabase';
import { calculateDistance, getCurrentMonth } from '@/utils/geo';
import { NearbySpot } from '@/utils/osmFishingSpots';

type Season = 'Winter' | 'Spring' | 'Summer' | 'Fall';

const SEASON_MONTHS: Record<Season, number[]> = {
  Winter: [12, 1, 2],
  Spring: [3, 4, 5],
  Summer: [6, 7, 8],
  Fall: [9, 10, 11],
};

function parseSeasons(bestSeason: string): Season[] {
  if (/year[- ]?round/i.test(bestSeason)) {
    return ['Winter', 'Spring', 'Summer', 'Fall'];
  }
  const seasons: Season[] = [];
  for (const season of Object.keys(SEASON_MONTHS) as Season[]) {
    if (bestSeason.toLowerCase().includes(season.toLowerCase())) {
      seasons.push(season);
    }
  }
  return seasons;
}

function seasonsToMonths(seasons: Season[]): number[] {
  return seasons.flatMap((season) => SEASON_MONTHS[season]);
}

function normalizeWaterType(waterType: string): string {
  const lower = waterType.toLowerCase();
  if (lower.includes('bay') || lower.includes('saltwater')) return 'bay';
  if (lower.includes('creek') || lower.includes('stream')) return 'stream';
  if (lower.includes('river')) return 'river';
  if (lower.includes('pond')) return 'pond';
  if (lower.includes('coastal') || lower.includes('shore')) return 'coastal';
  return 'lake';
}

function toNearbySpot(
  record: FishingSpotRecord,
  latitude: number,
  longitude: number
): NearbySpot {
  const currentMonth = getCurrentMonth();
  const bestMonths = seasonsToMonths(parseSeasons(record.bestSeason));
  const distance = calculateDistance(latitude, longitude, record.latitude, record.longitude);

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    latitude: record.latitude,
    longitude: record.longitude,
    water_type: normalizeWaterType(record.waterType),
    species: [],
    facilities: [],
    best_months: bestMonths,
    rating: 4.5,
    created_at: new Date().toISOString(),
    distance: Math.round(distance * 10) / 10,
    matchedSpecies: record.species,
    isPeakSeason: bestMonths.includes(currentMonth),
    avgDepthFeet: record.avgDepthFeet,
    underwaterStructure: record.underwaterStructure,
    bestSeason: record.bestSeason,
  };
}

/**
 * Curated local dataset — bundled with the app, so it's available instantly
 * and fully offline. Returned synchronously, no network involved.
 */
export function getLocalFishingSpots(
  latitude: number,
  longitude: number,
  radiusMiles: number
): NearbySpot[] {
  return fishingData
    .map((record) => toNearbySpot(record, latitude, longitude))
    .filter((spot) => spot.distance <= radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}
