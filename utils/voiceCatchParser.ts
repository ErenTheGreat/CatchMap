import speciesData from '@/data/species.json';

export interface ParsedVoiceCatch {
  species?: string;
  weight?: string;
  length?: string;
  lure?: string;
  notes?: string;
}

const SPECIES_NAMES = speciesData.map((s) => s.name);

const WEIGHT_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds|kg|kilos?|oz|ounce|ounces)/i;
const LENGTH_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:inch|inches|in|cm|centimeter|centimeters|"|''|')/i;

function findSpeciesInText(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const name of SPECIES_NAMES) {
    if (lower.includes(name.toLowerCase())) return name;
  }

  const aliases: Record<string, string> = {
    bass: 'Largemouth Bass',
    largemouth: 'Largemouth Bass',
    smallmouth: 'Smallmouth Bass',
    trout: 'Rainbow Trout',
    walleye: 'Walleye',
    pike: 'Northern Pike',
    catfish: 'Channel Catfish',
    crappie: 'Crappie',
    bluegill: 'Bluegill',
    salmon: 'Chinook Salmon',
    redfish: 'Redfish',
  };

  for (const [key, value] of Object.entries(aliases)) {
    if (lower.includes(key)) return value;
  }

  return undefined;
}

function extractLure(text: string, species?: string): string | undefined {
  const rigPatterns = [
    /texas rig/i,
    /carolina rig/i,
    /drop shot/i,
    /crankbait/i,
    /spinnerbait/i,
    /jig/i,
    /topwater/i,
    /soft plastic/i,
    /worm/i,
    /live bait/i,
    /nightcrawler/i,
  ];

  for (const pattern of rigPatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  const caughtWith = text.match(/(?:on|with|using)\s+(?:a\s+)?([a-z0-9\s-]+?)(?:\.|,|$)/i);
  if (caughtWith?.[1]) {
    const lure = caughtWith[1].trim();
    if (lure.length > 2 && lure.length < 40) return lure;
  }

  return undefined;
}

/**
 * Parses natural-language catch descriptions into form field values.
 * Example: "18 inch largemouth bass on texas rig"
 */
export function parseVoiceCatchTranscript(text: string): ParsedVoiceCatch {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const species = findSpeciesInText(trimmed);
  const weightMatch = trimmed.match(WEIGHT_PATTERN);
  const lengthMatch = trimmed.match(LENGTH_PATTERN);
  const lure = extractLure(trimmed, species);

  let weight: string | undefined;
  if (weightMatch) {
    const unit = weightMatch[0].toLowerCase();
    weight = unit.includes('kg') ? `${weightMatch[1]} kg` : `${weightMatch[1]} lb`;
  }

  let length: string | undefined;
  if (lengthMatch) {
    const unit = lengthMatch[0].toLowerCase();
    length = unit.includes('cm') ? `${lengthMatch[1]} cm` : `${lengthMatch[1]} in`;
  }

  const notes =
    !species && !weight && !length && !lure ? trimmed : undefined;

  return {
    species,
    weight,
    length,
    lure,
    notes,
  };
}

export function applyParsedVoiceCatch<T extends ParsedVoiceCatch>(
  current: T,
  parsed: ParsedVoiceCatch
): T {
  return {
    ...current,
    species: parsed.species ?? current.species,
    weight: parsed.weight ?? current.weight,
    length: parsed.length ?? current.length,
    lure: parsed.lure ?? current.lure,
    notes: parsed.notes
      ? current.notes
        ? `${current.notes} ${parsed.notes}`
        : parsed.notes
      : current.notes,
  };
}
