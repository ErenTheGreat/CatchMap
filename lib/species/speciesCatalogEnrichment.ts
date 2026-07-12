import type { FeedingZone } from '@/lib/types/speciesPrediction';
import type { SpeciesCatalogEntry } from '@/lib/types/speciesGuide';

/** Biology metadata for bundled Bay Area species (°C for ideal temps). */
const SPECIES_BIOLOGY: Record<
  string,
  { feedingZone: FeedingZone; idealTempMin: number; idealTempMax: number; nocturnal?: boolean }
> = {
  'Micropterus salmoides': { feedingZone: 'surface', idealTempMin: 18, idealTempMax: 27 },
  'Micropterus dolomieu': { feedingZone: 'surface', idealTempMin: 16, idealTempMax: 24 },
  'Oncorhynchus mykiss': { feedingZone: 'mid', idealTempMin: 10, idealTempMax: 18 },
  'Oncorhynchus nerka': { feedingZone: 'mid', idealTempMin: 12, idealTempMax: 16 },
  'Ictalurus punctatus': { feedingZone: 'bottom', idealTempMin: 21, idealTempMax: 29, nocturnal: true },
  'Morone saxatilis': { feedingZone: 'mid', idealTempMin: 14, idealTempMax: 22 },
  'Lepomis macrochirus': { feedingZone: 'surface', idealTempMin: 20, idealTempMax: 28 },
  'Lepomis cyanellus': { feedingZone: 'surface', idealTempMin: 20, idealTempMax: 28 },
  'Pomoxis nigromaculatus': { feedingZone: 'mid', idealTempMin: 14, idealTempMax: 22 },
  'Paralichthys californicus': { feedingZone: 'bottom', idealTempMin: 14, idealTempMax: 20 },
  'Myliobatis californica': { feedingZone: 'bottom', idealTempMin: 16, idealTempMax: 24, nocturnal: true },
  'Triakis semifasciata': { feedingZone: 'bottom', idealTempMin: 14, idealTempMax: 20, nocturnal: true },
};

export function enrichSpeciesFromCatalog(
  record: SpeciesCatalogEntry | null,
  fallbackName: string
): {
  feedingZone: FeedingZone;
  idealTempMin: number | null;
  idealTempMax: number | null;
  peakMonths: number[];
  habitat: string | null;
  waterTypes: string[];
  nocturnal: boolean;
} {
  const scientificName = record?.scientificName ?? '';
  const bio = SPECIES_BIOLOGY[scientificName];

  return {
    feedingZone: bio?.feedingZone ?? 'mid',
    idealTempMin: bio?.idealTempMin ?? null,
    idealTempMax: bio?.idealTempMax ?? null,
    peakMonths: record?.peakMonths ?? [],
    habitat: record?.habitat ?? null,
    waterTypes: record?.waterTypes ?? [],
    nocturnal: bio?.nocturnal ?? false,
  };
}

export function isNocturnalSpecies(scientificName: string): boolean {
  return SPECIES_BIOLOGY[scientificName]?.nocturnal ?? false;
}
