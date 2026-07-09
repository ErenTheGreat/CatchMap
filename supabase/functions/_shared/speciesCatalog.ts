/** Keep in sync with data/species.json — used by deprecated identify-species edge function. */
export const SPECIES_CATALOG_NAMES = [
  'Largemouth Bass',
  'Rainbow Trout',
  'Walleye',
  'Northern Pike',
  'Channel Catfish',
  'Bluegill',
  'Crappie',
  'Smallmouth Bass',
  'Yellow Perch',
  'Muskellunge',
  'Striped Bass',
  'Common Carp',
  'Steelhead',
  'Chinook Salmon',
  'Coho Salmon',
  'Redfish',
  'Spotted Seatrout',
  'Largemouth Bass - Trophy',
  'Lake Trout',
  'Flathead Catfish',
  'Kokanee Salmon',
  'Black Crappie',
  'Green Sunfish',
  'California Halibut',
  'Bat Ray',
  'Leopard Shark',
  'Brown Trout',
  'Brook Trout',
  'Blue Catfish',
  'Snook',
  'Tarpon',
  'Red Snapper',
  'Flounder',
  'King Mackerel',
  'Bluefish',
  'Black Drum',
  'Sheepshead',
  'Sauger',
  'White Bass',
  'Mahi Mahi',
] as const;

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
};

function normalizeSpeciesText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[\w-]*\n?|```$/g, '')
    .replace(/^["'`]+|["'.`]+$/g, '')
    .split('\n')[0]
    .trim();
}

export function matchSpeciesToCatalog(raw: string): string | null {
  const normalized = normalizeSpeciesText(raw);
  if (!normalized || normalized.toUpperCase() === 'UNKNOWN') return null;

  const lower = normalized.toLowerCase();

  const exact = SPECIES_CATALOG_NAMES.find((name) => name.toLowerCase() === lower);
  if (exact) return exact;

  const alias = SPECIES_ALIASES[lower];
  if (alias) return alias;

  const contained = SPECIES_CATALOG_NAMES.find((name) => lower.includes(name.toLowerCase()));
  if (contained) return contained;

  const reverse = SPECIES_CATALOG_NAMES.find((name) => name.toLowerCase().includes(lower));
  if (reverse) return reverse;

  return null;
}
