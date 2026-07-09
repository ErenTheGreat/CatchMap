/**
 * Helpers to keep user-facing species names readable — no raw Latin binomials
 * like "Cancer productus" (red rock crab) in recommendations.
 */

/** Genera that are not sport fish — skip in GBIF discoveries. */
const NON_FISH_GENERA = new Set([
  'cancer', // crabs (e.g. Cancer productus = red rock crab)
  'metacarcinus',
  'homarus',
  'pagurus',
  'palinurus',
  'callinectes',
  'carcinus',
  'mytilus',
  'crassostrea',
  'strongylocentrotus',
  'asterias',
  'pisaster',
]);

/** True when name looks like a Latin binomial (e.g. "Cancer productus"). */
export function looksLikeLatinBinomial(name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  const [genus, species] = parts;
  return /^[A-Z][a-z]+$/.test(genus) && /^[a-z]+$/.test(species);
}

export function isNonFishScientificName(scientificName: string): boolean {
  const genus = scientificName.trim().toLowerCase().split(/\s+/)[0];
  return NON_FISH_GENERA.has(genus);
}

/** Names safe to show anglers in chips, pickers, and recommendations. */
export function isUserFriendlySpeciesName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (looksLikeLatinBinomial(trimmed)) return false;
  if (/^(unknown|sp\.|cf\.)/i.test(trimmed)) return false;
  return true;
}

export function vernacularNameFromOccurrence(
  vernacularName: string | null | undefined,
  scientificName: string
): string | null {
  const vernacular = vernacularName?.trim();
  if (vernacular && isUserFriendlySpeciesName(vernacular)) {
    return vernacular;
  }
  if (isNonFishScientificName(scientificName)) {
    return null;
  }
  return null;
}
