import type { AvailableSpecies, FeedingZone } from '@/lib/types/speciesPrediction';
import type { SpeciesRig, RigType } from '@/lib/types/speciesRigs';

function feedingZoneToRigType(zone: FeedingZone): RigType {
  switch (zone) {
    case 'surface':
      return 'float';
    case 'mid':
      return 'spinning';
    case 'bottom':
      return 'bottom';
    default:
      return 'spinning';
  }
}

function feedingZoneToDepthLabel(zone: FeedingZone): string {
  switch (zone) {
    case 'surface':
      return 'surface';
    case 'mid':
      return 'mid-depth';
    case 'bottom':
      return 'bottom';
    default:
      return 'mid-depth';
  }
}

function buildTerminalComponent(
  zone: FeedingZone,
  speciesName: string
): { role: 'lure' | 'bait'; label: string } {
  if (zone === 'bottom') {
    return { role: 'bait', label: `Live or cut bait for ${speciesName}` };
  }
  if (zone === 'surface') {
    return { role: 'lure', label: `Topwater or floating lure for ${speciesName}` };
  }
  return { role: 'lure', label: `Jig or soft plastic for ${speciesName}` };
}

/**
 * Builds a provisional rig guide for GBIF-documented species not yet in the catalog.
 * Clearly labeled as AI-generated / provisional in the UI.
 */
export function buildGbifProvisionalRig(species: AvailableSpecies): SpeciesRig {
  const zone = species.feedingZone ?? 'mid';
  const rigType = feedingZoneToRigType(zone);
  const terminal = buildTerminalComponent(zone, species.name);
  const depthLabel = feedingZoneToDepthLabel(zone);

  return {
    id: `gbif-${species.id}-provisional`,
    name: `Provisional — ${species.name}`,
    rigType,
    isPrimary: true,
    targetDepth: zone === 'surface' ? 'surface' : zone === 'bottom' ? 'bottom' : 'mid',
    retrieve: `Work the ${depthLabel} zone with slow, deliberate presentations.`,
    components: [
      { role: 'rod', label: '6–7 ft medium action', detail: 'All-purpose setup' },
      { role: 'reel', label: '2500–3000 spinning reel' },
      { role: 'line', label: '8–12 lb monofilament or fluorocarbon' },
      { role: 'hook', label: 'Size matched to bait/lure' },
      terminal,
    ],
    steps: [
      `Rig for ${depthLabel} fishing based on documented habitat`,
      `Present ${terminal.label.toLowerCase()} near structure or cover`,
      'Adjust retrieve speed based on activity level',
    ],
    tip: species.scientificName
      ? `Documented as ${species.scientificName} near this area. Verify local regulations and species ID before keeping fish.`
      : 'Verify species ID and local regulations before keeping fish.',
  };
}

export function buildGbifProvisionalHowToCatch(species: AvailableSpecies): string {
  const zone = species.feedingZone ?? 'mid';
  const parts = [
    `${species.name} has been documented near this spot.`,
    species.scientificName ? `Scientific name: ${species.scientificName}.` : null,
    `Target the ${feedingZoneToDepthLabel(zone)} based on typical feeding behavior.`,
    species.idealTempMin != null && species.idealTempMax != null
      ? `Ideal water temp is roughly ${species.idealTempMin}–${species.idealTempMax}°C.`
      : null,
    'Use the provisional rig below as a starting point — always verify locally.',
  ];
  return parts.filter(Boolean).join(' ');
}
