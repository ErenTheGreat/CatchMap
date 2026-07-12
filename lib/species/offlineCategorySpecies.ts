import { findSpeciesCatalogEntry } from '@/utils/speciesGuide';
import { enrichSpeciesFromCatalog } from '@/lib/species/speciesCatalogEnrichment';
import type { AvailableSpecies, SpotContext } from '@/lib/types/speciesPrediction';

export type LocationCategory = 'Lakes & Ponds' | 'Rivers & Creeks' | 'Bays & Oceans';

interface CategorySpeciesDef {
  scientificName: string;
  monthStart: number;
  monthEnd: number;
}

/** Mirrors post-migration Supabase category defaults (017 creek, 018 lake). */
const OFFLINE_CATEGORY_SPECIES: Record<LocationCategory, CategorySpeciesDef[]> = {
  'Rivers & Creeks': [
    { scientificName: 'Micropterus salmoides', monthStart: 3, monthEnd: 10 },
    { scientificName: 'Oncorhynchus mykiss', monthStart: 1, monthEnd: 12 },
    { scientificName: 'Ictalurus punctatus', monthStart: 1, monthEnd: 12 },
    { scientificName: 'Micropterus dolomieu', monthStart: 4, monthEnd: 10 },
    { scientificName: 'Lepomis macrochirus', monthStart: 4, monthEnd: 10 },
    { scientificName: 'Pomoxis nigromaculatus', monthStart: 3, monthEnd: 11 },
    { scientificName: 'Lepomis cyanellus', monthStart: 4, monthEnd: 10 },
  ],
  'Lakes & Ponds': [
    { scientificName: 'Micropterus salmoides', monthStart: 3, monthEnd: 10 },
    { scientificName: 'Oncorhynchus mykiss', monthStart: 1, monthEnd: 12 },
    { scientificName: 'Ictalurus punctatus', monthStart: 1, monthEnd: 12 },
    { scientificName: 'Morone saxatilis', monthStart: 4, monthEnd: 11 },
    { scientificName: 'Micropterus dolomieu', monthStart: 4, monthEnd: 10 },
    { scientificName: 'Lepomis macrochirus', monthStart: 4, monthEnd: 10 },
    { scientificName: 'Pomoxis nigromaculatus', monthStart: 3, monthEnd: 11 },
  ],
  'Bays & Oceans': [
    { scientificName: 'Morone saxatilis', monthStart: 4, monthEnd: 11 },
    { scientificName: 'Paralichthys californicus', monthStart: 4, monthEnd: 10 },
    { scientificName: 'Myliobatis californica', monthStart: 5, monthEnd: 10 },
    { scientificName: 'Triakis semifasciata', monthStart: 5, monthEnd: 10 },
  ],
};

function monthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

/** Match Supabase category inference for bulk-imported locations. */
export function inferLocationCategory(
  spotName?: string | null,
  waterType?: string | null
): LocationCategory {
  const name = spotName?.toLowerCase() ?? '';
  const wt = waterType?.toLowerCase() ?? '';

  if (
    wt.includes('salt') ||
    /(?:^|\s)(bay|ocean|harbor|harbour|beach|coast)(?:\s|$)/.test(name)
  ) {
    return 'Bays & Oceans';
  }

  if (
    /(?:^|\s)(river|creek|stream|run)(?:\s|$)/.test(name) ||
    wt === 'river' ||
    wt === 'stream'
  ) {
    return 'Rivers & Creeks';
  }

  return 'Lakes & Ponds';
}

function mapCategorySpecies(def: CategorySpeciesDef, month: number): AvailableSpecies | null {
  if (!monthInRange(month, def.monthStart, def.monthEnd)) {
    return null;
  }

  const record = findSpeciesCatalogEntry(def.scientificName);
  if (!record) return null;

  const enriched = enrichSpeciesFromCatalog(record, record.name);

  return {
    id: record.id,
    name: record.name,
    scientificName: record.scientificName,
    imageUrl: record.image ?? null,
    feedingZone: enriched.feedingZone,
    idealTempMin: enriched.idealTempMin,
    idealTempMax: enriched.idealTempMax,
    monthStart: def.monthStart,
    monthEnd: def.monthEnd,
    peakMonths: enriched.peakMonths,
    habitat: enriched.habitat,
    waterTypes: enriched.waterTypes,
    nocturnal: enriched.nocturnal,
    source: 'category',
    dataConfidence: 'low',
  };
}

export function fetchOfflineCategorySpecies(
  category: LocationCategory,
  month: number = new Date().getMonth() + 1
): AvailableSpecies[] {
  return OFFLINE_CATEGORY_SPECIES[category]
    .map((def) => mapCategorySpecies(def, month))
    .filter((species): species is AvailableSpecies => species != null);
}

export function spotContextForCategory(category: LocationCategory): SpotContext {
  return {
    waterType:
      category === 'Bays & Oceans'
        ? 'Saltwater'
        : category === 'Rivers & Creeks'
          ? 'Freshwater'
          : 'Freshwater',
    avgDepthFeet: category === 'Bays & Oceans' ? 30 : 20,
    underwaterStructure: [],
    bestSeason: '',
    isSaltwater: category === 'Bays & Oceans',
  };
}

export function fetchOfflineCategorySpeciesForSpot(
  spotName?: string | null,
  waterType?: string | null,
  month: number = new Date().getMonth() + 1
): { species: AvailableSpecies[]; spotContext: SpotContext } {
  const category = inferLocationCategory(spotName, waterType);
  return {
    species: fetchOfflineCategorySpecies(category, month),
    spotContext: spotContextForCategory(category),
  };
}
