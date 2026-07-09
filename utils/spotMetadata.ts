import speciesData from '@/data/species.json';
import { fetchOfflineCategorySpeciesForSpot } from '@/lib/species/offlineCategorySpecies';
import { getCurrentMonth, getRegionFromCoordinates, type Region } from '@/utils/geo';
import type { NearbySpot } from '@/utils/osmFishingSpots';

const GENERIC_SPOT_NAMES = new Set([
  'fishing spot',
  'fishing area',
  'documented fish location',
  'imported location',
  'unnamed',
  'water',
]);

export function isGenericSpotName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  const normalized = name.trim().toLowerCase();
  if (GENERIC_SPOT_NAMES.has(normalized)) return true;
  if (/^documented:/i.test(name.trim())) return true;
  return /^fishing\s+(spot|area|pier|ground)$/i.test(normalized);
}

/** Map DB/OSM water labels to species.json waterTypes keys. */
export function normalizeWaterTypeForSpecies(
  waterType?: string | null,
  spotName?: string | null
): string {
  const wt = (waterType ?? '').toLowerCase();
  const name = spotName?.toLowerCase() ?? '';

  if (wt === 'freshwater' || wt === '') {
    if (/river|creek|stream|run/.test(name)) return 'river';
    if (/pond/.test(name)) return 'pond';
    if (/bay|harbor|harbour|coast|beach|ocean/.test(name)) return 'bay';
    return 'lake';
  }

  if (wt === 'saltwater') return 'coastal';
  return wt;
}

export function inferRegionalSpeciesHints(
  latitude: number,
  longitude: number,
  waterType?: string | null,
  spotName?: string | null
): {
  speciesIds: string[];
  matchedSpecies: string[];
  bestMonths: number[];
  isPeakSeason: boolean;
} {
  const normalizedWater = normalizeWaterTypeForSpecies(waterType, spotName);
  const currentMonth = getCurrentMonth();
  const regions = getRegionFromCoordinates(latitude, longitude);

  const matching = speciesData
    .filter((species) => {
      const regionMatch = species.regions.some((region) => regions.includes(region as Region));
      const waterMatch = species.waterTypes.includes(normalizedWater);
      return regionMatch && (waterMatch || normalizedWater === 'lake');
    })
    .sort((a, b) => {
      const aPeak = a.peakMonths.includes(currentMonth) ? 1 : 0;
      const bPeak = b.peakMonths.includes(currentMonth) ? 1 : 0;
      return bPeak - aPeak;
    })
    .slice(0, 5);

  const speciesIds = matching.map((species) => species.id);
  let matchedSpecies = matching
    .filter((species) => species.bestMonths.includes(currentMonth))
    .map((species) => species.name)
    .slice(0, 3);

  if (matchedSpecies.length === 0) {
    matchedSpecies = matching.slice(0, 3).map((species) => species.name);
  }

  if (matchedSpecies.length < 2) {
    const offline = fetchOfflineCategorySpeciesForSpot(spotName, waterType, currentMonth);
    for (const species of offline.species) {
      if (!speciesIds.includes(species.id) && speciesIds.length < 5) {
        speciesIds.push(species.id);
      }
      if (!matchedSpecies.includes(species.name) && matchedSpecies.length < 3) {
        matchedSpecies.push(species.name);
      }
    }
  }

  const bestMonths = [
    ...new Set(
      speciesData
        .filter((species) => speciesIds.includes(species.id))
        .flatMap((species) => species.bestMonths)
    ),
  ];

  const isPeakSeason = matching.some((species) => species.peakMonths.includes(currentMonth));

  return {
    speciesIds,
    matchedSpecies,
    bestMonths,
    isPeakSeason,
  };
}

export function resolveSpotDisplayName(options: {
  name?: string | null;
  waterType?: string | null;
  category?: string | null;
}): string {
  const { name, waterType, category } = options;
  if (!isGenericSpotName(name)) {
    return name!.trim();
  }

  const wt = (waterType ?? '').toLowerCase();
  const cat = (category ?? '').toLowerCase();

  if (cat === 'creek' || cat === 'river' || wt === 'stream' || wt === 'river') {
    return 'Creek access';
  }
  if (cat === 'lake' || wt === 'lake' || wt === 'pond') {
    return 'Lake fishing area';
  }
  if (cat === 'bay' || wt === 'saltwater' || wt === 'coastal' || wt === 'bay') {
    return 'Coastal fishing area';
  }
  if (wt === 'freshwater') {
    return 'Freshwater fishing area';
  }

  return 'Fishing area';
}

export function enrichNearbySpotFromLocation(
  spot: Omit<NearbySpot, 'matchedSpecies' | 'isPeakSeason'> &
    Partial<Pick<NearbySpot, 'matchedSpecies' | 'isPeakSeason'>>,
  options?: { category?: string | null }
): NearbySpot {
  const resolvedName = resolveSpotDisplayName({
    name: spot.name,
    waterType: spot.water_type,
    category: options?.category,
  });

  return {
    ...spot,
    name: resolvedName,
    species: spot.species ?? [],
    best_months: spot.best_months ?? [],
    matchedSpecies: spot.matchedSpecies ?? [],
    isPeakSeason: spot.isPeakSeason ?? false,
  };
}

export function formatSpotSpeciesSubtitle(spot: NearbySpot): string {
  const species = spot.matchedSpecies.slice(0, 2).join(', ');
  if (species) return species;

  const wt = normalizeWaterTypeForSpecies(spot.water_type, spot.name);
  switch (wt) {
    case 'river':
      return 'River fishing';
    case 'pond':
      return 'Pond fishing';
    case 'bay':
    case 'coastal':
      return 'Coastal fishing';
    case 'lake':
      return 'Lake fishing';
    default:
      return 'Fishing area';
  }
}
