import speciesData from '@/data/species.json';
import type {
  BuildLocationSpeciesGuideOptions,
  LocationSpeciesGuide,
  SpeciesCatalogEntry,
} from '@/lib/types/speciesGuide';
import type { FeedingZone } from '@/lib/types/speciesPrediction';
import { getWaterTypeIcon } from '@/utils/recommendations';
import {
  buildGbifProvisionalHowToCatch,
  buildGbifProvisionalRig,
} from '@/utils/gbifProvisionalGuide';
import { getAlternateRigs, getPrimaryRig } from '@/utils/speciesRigs';

const catalog = speciesData as SpeciesCatalogEntry[];

/** Maps predicted / bundled names to catalog entry names. */
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

  const byScientific = catalog.find(
    (entry) => entry.scientificName.trim().toLowerCase() === normalized
  );
  if (byScientific) return byScientific;

  return (
    catalog.find((entry) => normalized.includes(entry.name.toLowerCase())) ??
    catalog.find((entry) => entry.name.toLowerCase().includes(normalized)) ??
    null
  );
}

function buildFeedingZoneHint(zone: FeedingZone, waterType: string): string {
  const waterLabel = getWaterTypeIcon(waterType);
  switch (zone) {
    case 'surface':
      return `Target the surface and upper water column at this ${waterLabel}.`;
    case 'mid':
      return `Work the mid-depth zone at this ${waterLabel}.`;
    case 'bottom':
      return `Fish near the bottom at this ${waterLabel}.`;
    default:
      return `Focus on likely holding areas at this ${waterLabel}.`;
  }
}

function buildStructureHint(spot: BuildLocationSpeciesGuideOptions['spot']): string | null {
  const parts: string[] = [];
  if (spot.underwaterStructure?.length) {
    parts.push(`Look for ${spot.underwaterStructure.join(', ').toLowerCase()}.`);
  }
  if (spot.avgDepthFeet != null) {
    parts.push(`Average depth here is about ${spot.avgDepthFeet} ft.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

function buildLocationContext(
  species: BuildLocationSpeciesGuideOptions['species'],
  spot: BuildLocationSpeciesGuideOptions['spot']
): string {
  const hints = [
    buildFeedingZoneHint(species.feedingZone, spot.water_type),
    buildStructureHint(spot),
  ].filter(Boolean);

  return hints.join(' ');
}

export function buildLocationSpeciesGuide(
  options: BuildLocationSpeciesGuideOptions
): LocationSpeciesGuide {
  const { species, prediction, spot, bestCatchTimes = [] } = options;
  const catalogEntry = findSpeciesCatalogEntry(species.name);
  const activityRating = prediction?.activityRating ?? 'Moderate';
  const locationContext = buildLocationContext(species, spot);

  if (!catalogEntry) {
    const isDiscovered = species.source === 'gbif_discovered' || species.inCatalog === false;
    const isGbifSource =
      isDiscovered || species.source === 'gbif' || species.source === 'gbif_discovered';
    const provisionalRig = isGbifSource ? buildGbifProvisionalRig(species) : undefined;
    const howToCatch = isGbifSource
      ? buildGbifProvisionalHowToCatch(species)
      : [
          `Activity at this spot is ${activityRating.toLowerCase()} right now.`,
          locationContext,
          species.idealTempMin != null && species.idealTempMax != null
            ? `Ideal water temp is ${species.idealTempMin}–${species.idealTempMax}°C.`
            : null,
        ]
          .filter(Boolean)
          .join(' ');

    const terminal = provisionalRig?.components.find(
      (c) => c.role === 'lure' || c.role === 'bait'
    );

    return {
      species,
      prediction,
      activityRating,
      howToCatch,
      hookSize: null,
      bait: terminal?.role === 'bait' ? [terminal.label] : [],
      lures: terminal?.role === 'lure' ? [terminal.label] : [],
      habitat: species.scientificName ? `${species.name} (${species.scientificName})` : null,
      averageWeight: null,
      imageUrl: species.imageUrl,
      locationContext,
      bestCatchTimes,
      hasCatalogData: false,
      primaryRig: provisionalRig,
    };
  }

  const howToCatch = [catalogEntry.tips, locationContext].filter(Boolean).join(' ');
  const primaryRig = getPrimaryRig(catalogEntry.id) ?? undefined;
  const alternateRigs = getAlternateRigs(catalogEntry.id);

  return {
    species,
    prediction,
    activityRating,
    howToCatch,
    hookSize: catalogEntry.hookSize,
    bait: catalogEntry.bait,
    lures: catalogEntry.lures,
    habitat: catalogEntry.habitat,
    averageWeight: catalogEntry.averageWeight,
    imageUrl: species.imageUrl ?? catalogEntry.image,
    locationContext,
    bestCatchTimes,
    hasCatalogData: true,
    primaryRig,
    alternateRigs: alternateRigs.length > 0 ? alternateRigs : undefined,
  };
}
