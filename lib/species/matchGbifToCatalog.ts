import speciesCatalog from '@/data/species.json';
import { enrichSpeciesFromCatalog } from '@/lib/species/speciesCatalogEnrichment';
import type { GbifOccurrence } from '@/lib/species/gbifSpecies';
import type { AvailableSpecies } from '@/lib/types/speciesPrediction';
import type { SpeciesCatalogEntry } from '@/lib/types/speciesGuide';
import {
  isNonFishScientificName,
  vernacularNameFromOccurrence,
} from '@/lib/species/speciesDisplayName';

const catalogEntries = speciesCatalog as SpeciesCatalogEntry[];

/** Max undocumented GBIF species shown per spot (after catalog matches). */
export const MAX_DISCOVERED_GBIF_SPECIES = 2;

const catalogByScientificName = new Map<string, SpeciesCatalogEntry>();
for (const entry of catalogEntries) {
  const key = normalizeScientificName(entry.scientificName);
  if (!catalogByScientificName.has(key)) {
    catalogByScientificName.set(key, entry);
  }
}

/** Binomial form only — strips subspecies / variety suffixes. */
export function normalizeScientificName(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts.join(' ');
}

export function findCatalogEntryByScientificName(
  scientificName: string
): SpeciesCatalogEntry | null {
  return catalogByScientificName.get(normalizeScientificName(scientificName)) ?? null;
}

export interface GbifMatchResult {
  catalog: AvailableSpecies[];
  discovered: AvailableSpecies[];
}

function isValidBinomial(scientificName: string): boolean {
  const normalized = scientificName.trim().toLowerCase();
  if (!normalized || normalized.includes(' sp.') || normalized.includes(' cf.')) {
    return false;
  }
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts[0] !== 'unknown';
}

function displayNameFromOccurrence(occurrence: GbifOccurrence): string | null {
  return vernacularNameFromOccurrence(
    occurrence.vernacularName,
    occurrence.scientificName
  );
}

function mapCatalogOccurrence(
  record: SpeciesCatalogEntry,
  month: number
): AvailableSpecies {
  const enriched = enrichSpeciesFromCatalog(record, record.name);
  const monthStart = record.bestMonths.length > 0 ? Math.min(...record.bestMonths) : 1;
  const monthEnd = record.bestMonths.length > 0 ? Math.max(...record.bestMonths) : 12;

  return {
    id: record.id,
    name: record.name,
    scientificName: record.scientificName,
    imageUrl: record.image ?? null,
    feedingZone: enriched.feedingZone,
    idealTempMin: enriched.idealTempMin,
    idealTempMax: enriched.idealTempMax,
    monthStart,
    monthEnd,
    peakMonths: enriched.peakMonths,
    habitat: enriched.habitat,
    waterTypes: enriched.waterTypes,
    nocturnal: enriched.nocturnal,
    source: 'gbif',
    dataConfidence: 'medium',
    inCatalog: true,
  };
}

function mapDiscoveredOccurrence(
  occurrence: GbifOccurrence,
  displayName: string
): AvailableSpecies {
  const normalized = normalizeScientificName(occurrence.scientificName);
  const id =
    occurrence.speciesKey != null
      ? `gbif-discovered:${occurrence.speciesKey}`
      : `gbif-discovered:${normalized.replace(/\s+/g, '-')}`;

  return {
    id,
    name: displayName,
    scientificName: occurrence.scientificName.trim(),
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: null,
    idealTempMax: null,
    monthStart: 1,
    monthEnd: 12,
    source: 'gbif_discovered',
    dataConfidence: 'low',
    inCatalog: false,
  };
}

export function matchGbifOccurrences(
  occurrences: GbifOccurrence[],
  month: number = new Date().getMonth() + 1
): GbifMatchResult {
  const catalogByName = new Map<string, AvailableSpecies>();
  const discoveredByName = new Map<string, AvailableSpecies>();

  for (const occurrence of occurrences) {
    if (!isValidBinomial(occurrence.scientificName)) continue;
    if (isNonFishScientificName(occurrence.scientificName)) continue;

    const record = findCatalogEntryByScientificName(occurrence.scientificName);
    if (record) {
      const normalized = normalizeScientificName(record.scientificName);
      if (!catalogByName.has(normalized)) {
        catalogByName.set(normalized, mapCatalogOccurrence(record, month));
      }
      continue;
    }

    const displayName = displayNameFromOccurrence(occurrence);
    if (!displayName) continue;

    const normalized = normalizeScientificName(occurrence.scientificName);
    if (!discoveredByName.has(normalized)) {
      discoveredByName.set(normalized, mapDiscoveredOccurrence(occurrence, displayName));
    }
  }

  const catalog = Array.from(catalogByName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const discovered = Array.from(discoveredByName.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_DISCOVERED_GBIF_SPECIES);

  return { catalog, discovered };
}

/** Merged GBIF list: catalog matches first, then undocumented discoveries. */
export function buildGbifSpeciesList(result: GbifMatchResult): AvailableSpecies[] {
  const seenNames = new Set<string>();
  const merged: AvailableSpecies[] = [];

  for (const item of [...result.catalog, ...result.discovered]) {
    const nameKey = item.name.trim().toLowerCase();
    if (!nameKey || seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    merged.push(item);
  }

  return merged;
}

/** @deprecated Use matchGbifOccurrences + buildGbifSpeciesList */
export function matchGbifOccurrencesToCatalog(
  occurrences: GbifOccurrence[],
  month: number = new Date().getMonth() + 1
): AvailableSpecies[] {
  return buildGbifSpeciesList(matchGbifOccurrences(occurrences, month));
}
