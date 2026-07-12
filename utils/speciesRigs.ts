import speciesRigsData from '@/data/speciesRigs.json';
import speciesData from '@/data/species.json';
import type { SpeciesRig, SpeciesRigsEntry } from '@/lib/types/speciesRigs';
import type { SpeciesCatalogEntry } from '@/lib/types/speciesGuide';

const rigsCatalog = speciesRigsData as SpeciesRigsEntry[];
const speciesCatalog = speciesData as SpeciesCatalogEntry[];

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

function resolveSpeciesId(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  const aliasTarget = SPECIES_NAME_ALIASES[normalized];

  let entry: SpeciesCatalogEntry | undefined;
  if (aliasTarget) {
    entry = speciesCatalog.find((e) => e.name.toLowerCase() === aliasTarget.toLowerCase());
  }
  if (!entry) {
    entry = speciesCatalog.find((e) => e.name.toLowerCase() === normalized);
  }
  if (!entry) {
    entry =
      speciesCatalog.find((e) => normalized.includes(e.name.toLowerCase())) ??
      speciesCatalog.find((e) => e.name.toLowerCase().includes(normalized));
  }
  return entry?.id ?? null;
}

const rigsBySpeciesId = new Map<string, SpeciesRig[]>(
  rigsCatalog.map((entry) => [entry.speciesId, entry.rigs])
);

export function getRigsForSpecies(speciesId: string): SpeciesRig[] {
  return rigsBySpeciesId.get(speciesId) ?? [];
}

export function getRigsForSpeciesName(name: string): SpeciesRig[] {
  const speciesId = resolveSpeciesId(name);
  if (!speciesId) return [];
  return getRigsForSpecies(speciesId);
}

export function getPrimaryRig(speciesId: string): SpeciesRig | null {
  const rigs = getRigsForSpecies(speciesId);
  return rigs.find((rig) => rig.isPrimary) ?? rigs[0] ?? null;
}

export function getPrimaryRigForName(name: string): SpeciesRig | null {
  const speciesId = resolveSpeciesId(name);
  if (!speciesId) return null;
  return getPrimaryRig(speciesId);
}

export function getPrimaryLureLabel(speciesId: string): string | null {
  const primary = getPrimaryRig(speciesId);
  if (!primary) return null;

  const terminal = primary.components.find(
    (component) => component.role === 'lure' || component.role === 'bait'
  );
  return terminal?.label ?? null;
}

export function getAlternateRigs(speciesId: string): SpeciesRig[] {
  return getRigsForSpecies(speciesId).filter((rig) => !rig.isPrimary);
}

export function getRigTypeLabel(rigType: SpeciesRig['rigType']): string {
  const labels: Record<SpeciesRig['rigType'], string> = {
    spinning: 'SPIN',
    baitcasting: 'CAST',
    fly: 'FLY',
    surf: 'SURF',
    bottom: 'BOTTOM',
    trolling: 'TROLL',
    float: 'FLOAT',
    jigging: 'JIG',
  };
  return labels[rigType];
}
