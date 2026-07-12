import speciesData from '@/data/species.json';
import { matchSpeciesToCatalog } from '@/lib/species/matchSpeciesToCatalog';
import { isUserFriendlySpeciesName } from '@/lib/species/speciesDisplayName';

export interface SpeciesSuggestion {
  name: string;
  score: number;
  source: 'location' | 'season' | 'catalog' | 'history';
  reason?: string;
}

export interface SuggestSpeciesOptions {
  latitude?: number | null;
  longitude?: number | null;
  waterType?: string | null;
  speciesOptions?: string[];
  recentCatches?: Array<{ species: string }>;
  month?: number;
  limit?: number;
}

function getRegionFromCoords(lat: number, lon: number): string {
  if (lon < -115) return 'west';
  if (lon < -100) return 'southwest';
  if (lon < -85) return 'midwest';
  if (lat < 35) return 'southeast';
  return 'northeast';
}

function waterTypeMatches(speciesWaterTypes: string[], spotWaterType: string | null): boolean {
  if (!spotWaterType) return true;
  const normalized = spotWaterType.toLowerCase();
  if (normalized.includes('salt') || normalized === 'coastal') {
    return speciesWaterTypes.some((w) => w === 'coastal' || w === 'saltwater');
  }
  if (normalized.includes('fresh') || normalized === 'lake' || normalized === 'river') {
    return speciesWaterTypes.some((w) => w === 'lake' || w === 'river' || w === 'pond' || w === 'stream');
  }
  return true;
}

function scoreSpecies(
  name: string,
  options: SuggestSpeciesOptions
): SpeciesSuggestion | null {
  const entry = speciesData.find((s) => s.name === name);
  if (!entry) return null;

  let score = 0;
  let source: SpeciesSuggestion['source'] = 'catalog';
  let reason: string | undefined;

  const month = options.month ?? new Date().getMonth() + 1;

  if (entry.peakMonths?.includes(month)) {
    score += 40;
    source = 'season';
    reason = 'Peak season now';
  } else if (entry.bestMonths?.includes(month)) {
    score += 25;
    source = 'season';
    reason = 'In season';
  }

  if (options.latitude != null && options.longitude != null) {
    const region = getRegionFromCoords(options.latitude, options.longitude);
    if (entry.regions?.includes(region)) {
      score += 30;
      source = 'location';
      reason = reason ?? 'Common in this region';
    }
    if (waterTypeMatches(entry.waterTypes ?? [], options.waterType ?? null)) {
      score += 15;
    }
  }

  if (options.speciesOptions?.includes(name)) {
    score += 50;
    source = 'location';
    reason = 'Seen at this spot';
  }

  const recentCount = (options.recentCatches ?? []).filter(
    (c) => c.species.toLowerCase() === name.toLowerCase()
  ).length;
  if (recentCount > 0) {
    score += 20 + recentCount * 5;
    source = 'history';
    reason = `You've caught ${recentCount} here`;
  }

  if (score === 0) score = 5;

  return { name, score, source, reason };
}

export function suggestSpeciesFromContext(options: SuggestSpeciesOptions): SpeciesSuggestion[] {
  const limit = options.limit ?? 6;
  const candidates = new Set<string>();

  for (const entry of speciesData) {
    candidates.add(entry.name);
  }
  for (const name of options.speciesOptions ?? []) {
    const match = matchSpeciesToCatalog(name);
    if (match) candidates.add(match);
    else if (isUserFriendlySpeciesName(name)) candidates.add(name);
  }
  for (const c of options.recentCatches ?? []) {
    const match = matchSpeciesToCatalog(c.species);
    if (match) candidates.add(match);
    else if (isUserFriendlySpeciesName(c.species)) candidates.add(c.species);
  }

  const scored = [...candidates]
    .map((name) => scoreSpecies(name, options))
    .filter((s): s is SpeciesSuggestion => s != null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
