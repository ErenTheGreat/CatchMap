import speciesData from '@/data/species.json';
import type { SpeciesCatalogEntry } from '@/lib/types/speciesGuide';

const catalog = speciesData as SpeciesCatalogEntry[];

const SPECIES_NAME_ALIASES: Record<string, string> = {
  sunfish: 'Bluegill',
  'black crappie': 'Black Crappie',
  crappie: 'Crappie',
  halibut: 'California Halibut',
  'cal halibut': 'California Halibut',
  'bat ray': 'Bat Ray',
  'leopard shark': 'Leopard Shark',
  kokanee: 'Kokanee Salmon',
  'green sunfish': 'Green Sunfish',
};

export function findSpeciesCatalogEntry(name: string): SpeciesCatalogEntry | null {
  const normalized = name.trim().toLowerCase();
  const aliasTarget = SPECIES_NAME_ALIASES[normalized];

  if (aliasTarget) {
    const aliasMatch = catalog.find((entry) => entry.name.toLowerCase() === aliasTarget.toLowerCase());
    if (aliasMatch) return aliasMatch;
  }

  const exact = catalog.find((entry) => entry.name.toLowerCase() === normalized);
  if (exact) return exact;

  return (
    catalog.find((entry) => normalized.includes(entry.name.toLowerCase())) ??
    catalog.find((entry) => entry.name.toLowerCase().includes(normalized)) ??
    null
  );
}
