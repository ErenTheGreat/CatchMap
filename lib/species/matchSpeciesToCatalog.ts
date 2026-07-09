import speciesData from '@/data/species.json';

export const SPECIES_CATALOG_NAMES = speciesData.map((item) => item.name);

/** Short names Gemini may return that map to catalog entries. */
const SPECIES_ALIASES: Record<string, string> = {
  carp: 'Common Carp',
  'common carp': 'Common Carp',
  crappie: 'Crappie',
  'black crappie': 'Black Crappie',
  'white crappie': 'Crappie',
  seatrout: 'Spotted Seatrout',
  'spotted seatrout': 'Spotted Seatrout',
  'speckled trout': 'Spotted Seatrout',
  trout: 'Rainbow Trout',
  bass: 'Largemouth Bass',
  largemouth: 'Largemouth Bass',
  smallmouth: 'Smallmouth Bass',
  catfish: 'Channel Catfish',
  salmon: 'Chinook Salmon',
  halibut: 'California Halibut',
  shark: 'Leopard Shark',
  ray: 'Bat Ray',
  snook: 'Snook',
  tarpon: 'Tarpon',
  flounder: 'Flounder',
  'red snapper': 'Red Snapper',
  'king mackerel': 'King Mackerel',
  'kingfish': 'King Mackerel',
  bluefish: 'Bluefish',
  'brown trout': 'Brown Trout',
  'brook trout': 'Brook Trout',
  'blue catfish': 'Blue Catfish',
  'black drum': 'Black Drum',
  sheepshead: 'Sheepshead',
  sauger: 'Sauger',
  'white bass': 'White Bass',
  'mahi mahi': 'Mahi Mahi',
  mahi: 'Mahi Mahi',
  dolphin: 'Mahi Mahi',
};

function normalizeSpeciesText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[\w-]*\n?|```$/g, '')
    .replace(/^["'`]+|["'.`]+$/g, '')
    .split('\n')[0]
    .trim();
}

export interface SpeciesMatchResult {
  name: string;
  provisional: boolean;
}

/** Map a model response to a species name from the app catalog. */
export function matchSpeciesToCatalog(raw: string): string | null {
  return matchSpeciesToCatalogDetailed(raw)?.name ?? null;
}

/** Map with provisional fallback when the species is not in the catalog. */
export function matchSpeciesToCatalogDetailed(raw: string): SpeciesMatchResult | null {
  const normalized = normalizeSpeciesText(raw);
  if (!normalized || normalized.toUpperCase() === 'UNKNOWN') return null;

  const lower = normalized.toLowerCase();

  const exact = SPECIES_CATALOG_NAMES.find((name) => name.toLowerCase() === lower);
  if (exact) return { name: exact, provisional: false };

  const alias = SPECIES_ALIASES[lower];
  if (alias) return { name: alias, provisional: false };

  const contained = SPECIES_CATALOG_NAMES.find((name) => lower.includes(name.toLowerCase()));
  if (contained) return { name: contained, provisional: false };

  const reverse = SPECIES_CATALOG_NAMES.find((name) => name.toLowerCase().includes(lower));
  if (reverse) return { name: reverse, provisional: false };

  if (normalized.length >= 3 && normalized.length <= 80) {
    return { name: normalized, provisional: true };
  }

  return null;
}
