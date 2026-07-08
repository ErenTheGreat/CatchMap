interface NamedSpecies {
  name: string;
}

/** Species names to show when logging a catch from a map spot. */
export function getSpotLogSpeciesOptions(
  predictions: NamedSpecies[],
  availableSpecies: NamedSpecies[]
): string[] {
  const source = predictions.length > 0 ? predictions : availableSpecies;
  const seen = new Set<string>();
  const names: string[] = [];

  for (const item of source) {
    const name = item.name?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names;
}

export function sortCatalogSpeciesByPreference<T extends { name: string }>(
  catalog: T[],
  preferredNames: string[]
): T[] {
  if (preferredNames.length === 0) return catalog;

  const rank = new Map(preferredNames.map((name, index) => [name, index]));
  return [...catalog].sort((left, right) => {
    const leftRank = rank.get(left.name);
    const rightRank = rank.get(right.name);
    if (leftRank != null && rightRank != null) return leftRank - rightRank;
    if (leftRank != null) return -1;
    if (rightRank != null) return 1;
    return left.name.localeCompare(right.name);
  });
}
