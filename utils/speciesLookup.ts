import speciesData from '@/data/species.json';

export function getSpeciesImageUrl(speciesName: string, speciesId?: string): string | null {
  const byId = speciesId ? speciesData.find((s) => s.id === speciesId) : undefined;
  const match = byId ?? speciesData.find((s) => s.name === speciesName);
  return match?.image ?? null;
}
