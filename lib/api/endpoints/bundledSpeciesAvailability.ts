import fishingData from '@/data/FishingDatabase.js';
import {
  BUNDLED_SPOT_TO_LOCATION_UUID,
  bundledSpotIdToLocationUuid,
} from '@/lib/api/bundledLocationIds';
import { findSpeciesCatalogEntry } from '@/utils/speciesGuide';
import { enrichSpeciesFromCatalog } from '@/lib/species/speciesCatalogEnrichment';
import type {
  AvailableSpecies,
  DataConfidence,
  SpotContext,
  SpeciesSource,
} from '@/lib/types/speciesPrediction';

const LOCATION_UUID_TO_BUNDLED_SPOT = Object.fromEntries(
  Object.entries(BUNDLED_SPOT_TO_LOCATION_UUID).map(([spotId, uuid]) => [uuid, spotId])
);

export function findBundledSpot(locationId: string | null) {
  const stripped = locationId?.startsWith('postgis-')
    ? locationId.slice('postgis-'.length)
    : locationId;

  const bundledSpotId =
    (stripped && bundledSpotIdToLocationUuid(stripped)) ||
    (stripped && LOCATION_UUID_TO_BUNDLED_SPOT[stripped]) ||
    null;

  if (!bundledSpotId) return null;
  return fishingData.find((spot) => spot.id === bundledSpotId) ?? null;
}

export function getBundledSpotContext(
  bundledSpot: (typeof fishingData)[number]
): SpotContext {
  const waterType = bundledSpot.waterType ?? '';
  return {
    waterType,
    avgDepthFeet: bundledSpot.avgDepthFeet ?? 0,
    underwaterStructure: bundledSpot.underwaterStructure ?? [],
    bestSeason: bundledSpot.bestSeason ?? '',
    isSaltwater: /salt|bay|ocean|coast/i.test(waterType),
  };
}

function monthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function mapBundledSpecies(
  name: string,
  month: number,
  source: SpeciesSource = 'bundled',
  dataConfidence: DataConfidence = 'high'
): AvailableSpecies | null {
  const record = findSpeciesCatalogEntry(name);
  const bestMonths = record?.bestMonths ?? [];
  if (bestMonths.length > 0 && !bestMonths.includes(month)) {
    return null;
  }

  const monthStart = bestMonths.length > 0 ? Math.min(...bestMonths) : 1;
  const monthEnd = bestMonths.length > 0 ? Math.max(...bestMonths) : 12;
  const enriched = enrichSpeciesFromCatalog(record, name);

  return {
    id: record?.id ?? name,
    name: record?.name ?? name,
    scientificName: record?.scientificName ?? '',
    imageUrl: record?.image ?? null,
    feedingZone: enriched.feedingZone,
    idealTempMin: enriched.idealTempMin,
    idealTempMax: enriched.idealTempMax,
    monthStart,
    monthEnd,
    peakMonths: enriched.peakMonths,
    habitat: enriched.habitat,
    waterTypes: enriched.waterTypes,
    nocturnal: enriched.nocturnal,
    source,
    dataConfidence,
  };
}

/** Authoritative Bay Area species list from bundled FishingDatabase.js. */
export function fetchBundledSpeciesAvailability(
  locationId: string | null,
  month: number = new Date().getMonth() + 1
): AvailableSpecies[] {
  const bundledSpot = findBundledSpot(locationId);
  if (!bundledSpot) return [];

  return bundledSpot.species.flatMap((name) => {
    const item = mapBundledSpecies(name, month);
    return item ? [item] : [];
  });
}

export function fetchBundledSpeciesAvailabilityWithContext(
  locationId: string | null,
  month: number = new Date().getMonth() + 1
): { species: AvailableSpecies[]; spotContext: SpotContext | null } {
  const bundledSpot = findBundledSpot(locationId);
  if (!bundledSpot) {
    return { species: [], spotContext: null };
  }

  return {
    species: fetchBundledSpeciesAvailability(locationId, month),
    spotContext: getBundledSpotContext(bundledSpot),
  };
}

export { monthInRange };
