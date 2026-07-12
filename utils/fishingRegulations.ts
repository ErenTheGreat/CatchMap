import regulationsData from '@/data/fishingRegulations.json';
import usStateLicenseData from '@/data/usStateFishingLicense.json';
import type {
  CatchRegulationCheck,
  CatchRegulationSeasonStatus,
  CatchSizeCheck,
  FishingRegulationsData,
  ProtectedAreaConfig,
  RegulationNotice,
  RegulationSeverity,
  SpeciesRuleConfig,
  StateRegulationConfig,
} from '@/lib/types/fishingRegulations';
import { calculateDistance, getCurrentMonth } from '@/utils/geo';
import type { NearbySpot } from '@/utils/recommendations';

const baseStates = usStateLicenseData.states as Record<string, StateRegulationConfig>;
const overrideStates = regulationsData.states as Record<string, StateRegulationConfig>;

const mergedStates: Record<string, StateRegulationConfig> = { ...baseStates };
for (const [code, override] of Object.entries(overrideStates)) {
  const base = baseStates[code];
  mergedStates[code] = {
    ...base,
    ...override,
    notes: {
      ...base?.notes,
      ...override.notes,
    },
    bbox: override.bbox ?? base?.bbox,
  };
}

const data: FishingRegulationsData = {
  ...(regulationsData as FishingRegulationsData),
  states: mergedStates,
};

type WaterCategory = 'freshwater' | 'coastal';

interface StateBbox {
  code: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function bboxArea(bbox: StateBbox): number {
  return (bbox.maxLat - bbox.minLat) * (bbox.maxLon - bbox.minLon);
}

/** Smaller states first so border points resolve to the narrower match. */
const STATE_BBOXES: StateBbox[] = Object.entries(data.states)
  .map(([code, state]) => {
    if (!state.bbox) return null;
    return {
      code,
      minLat: state.bbox.minLat,
      maxLat: state.bbox.maxLat,
      minLon: state.bbox.minLon,
      maxLon: state.bbox.maxLon,
    };
  })
  .filter((entry): entry is StateBbox => entry != null)
  .sort((left, right) => bboxArea(left) - bboxArea(right));

const FRESHWATER_TYPES = new Set([
  'lake',
  'river',
  'pond',
  'stream',
  'freshwater',
  'creek',
]);

const COASTAL_TYPES = new Set([
  'coastal',
  'bay',
  'saltwater',
  'brackish',
  'estuary',
]);

const SEVERITY_RANK: Record<RegulationSeverity, number> = {
  closed: 0,
  warning: 1,
  info: 2,
};

export function getStateFromCoordinates(lat: number, lon: number): string | null {
  for (const bbox of STATE_BBOXES) {
    if (
      lat >= bbox.minLat &&
      lat <= bbox.maxLat &&
      lon >= bbox.minLon &&
      lon <= bbox.maxLon
    ) {
      return bbox.code;
    }
  }
  return null;
}

function getWaterCategory(waterType: string): WaterCategory {
  const normalized = waterType.toLowerCase();
  if (COASTAL_TYPES.has(normalized)) return 'coastal';
  if (FRESHWATER_TYPES.has(normalized)) return 'freshwater';
  return 'freshwater';
}

function getStateLicenseMessage(
  state: StateRegulationConfig,
  waterCategory?: WaterCategory
): string {
  if (waterCategory) {
    return state.notes[waterCategory];
  }

  return `${state.notes.freshwater} ${state.notes.coastal}`;
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistance(lat1, lon1, lat2, lon2) * 1.60934;
}

export function isNearProtectedArea(
  lat: number,
  lon: number
): ProtectedAreaConfig | null {
  let closest: ProtectedAreaConfig | null = null;
  let closestDistance = Infinity;

  for (const area of data.protectedAreas) {
    const dist = distanceKm(lat, lon, area.lat, area.lon);
    if (dist <= area.radiusKm && dist < closestDistance) {
      closest = area;
      closestDistance = dist;
    }
  }

  return closest;
}

function sortNotices(notices: RegulationNotice[]): RegulationNotice[] {
  return [...notices].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}

function appendLicenseNotice(
  notices: RegulationNotice[],
  stateCode: string,
  waterCategory?: WaterCategory
): void {
  const state = data.states[stateCode];
  if (!state?.licenseRequired) return;

  notices.push({
    id: `license-${stateCode}`,
    severity: 'info',
    title: `${state.name} license required`,
    message: getStateLicenseMessage(state, waterCategory),
    regulationsUrl: state.regulationsUrl,
  });
}

export function getAreaRegulationNotices(lat: number, lon: number): RegulationNotice[] {
  const notices: RegulationNotice[] = [];
  const stateCode = getStateFromCoordinates(lat, lon);

  const protectedArea = isNearProtectedArea(lat, lon);
  if (protectedArea) {
    const stateConfig = data.states[protectedArea.state];
    notices.push({
      id: `protected-${protectedArea.id}`,
      severity: protectedArea.severity,
      title: protectedArea.name,
      message: protectedArea.message,
      regulationsUrl: stateConfig?.regulationsUrl,
    });
  }

  if (stateCode && data.states[stateCode]) {
    appendLicenseNotice(notices, stateCode);
  } else if (!stateCode) {
    notices.push({
      id: 'fallback-regulations',
      severity: 'info',
      title: data.fallback.title,
      message: data.fallback.message,
      regulationsUrl: data.fallback.regulationsUrl,
    });
  }

  const seen = new Set<string>();
  return sortNotices(notices).filter((notice) => {
    if (seen.has(notice.id)) return false;
    seen.add(notice.id);
    return true;
  });
}

export function getSpotRegulationNotices(spot: NearbySpot): RegulationNotice[] {
  const notices: RegulationNotice[] = [];
  const stateCode = getStateFromCoordinates(spot.latitude, spot.longitude);
  const waterCategory = getWaterCategory(spot.water_type);
  const currentMonth = getCurrentMonth();

  const protectedArea = isNearProtectedArea(spot.latitude, spot.longitude);
  if (protectedArea) {
    const stateConfig = data.states[protectedArea.state];
    notices.push({
      id: `protected-${protectedArea.id}`,
      severity: protectedArea.severity,
      title: protectedArea.name,
      message: protectedArea.message,
      regulationsUrl: stateConfig?.regulationsUrl,
    });
  }

  if (stateCode && data.states[stateCode]) {
    const state = data.states[stateCode];
    appendLicenseNotice(notices, stateCode, waterCategory);

    for (const rule of data.speciesRules) {
      if (!rule.states.includes(stateCode)) continue;
      if (!rule.waterTypes.includes(spot.water_type.toLowerCase())) continue;
      if (!rule.closedMonths.includes(currentMonth)) continue;

      notices.push({
        id: `species-${stateCode}-${rule.speciesName.toLowerCase().replace(/\s+/g, '-')}`,
        severity: 'warning',
        title: `${rule.speciesName} restrictions`,
        message: rule.message,
        regulationsUrl: state.regulationsUrl,
      });
    }
  } else if (!stateCode) {
    notices.push({
      id: 'fallback-regulations',
      severity: 'info',
      title: data.fallback.title,
      message: data.fallback.message,
      regulationsUrl: data.fallback.regulationsUrl,
    });
  }

  const seen = new Set<string>();
  return sortNotices(notices).filter((notice) => {
    if (seen.has(notice.id)) return false;
    seen.add(notice.id);
    return true;
  });
}

function normalizeSpeciesLabel(value: string): string {
  return value.trim().toLowerCase();
}

function speciesMatchesRule(rule: SpeciesRuleConfig, speciesName: string): boolean {
  const normalized = normalizeSpeciesLabel(speciesName);
  if (!normalized) return false;

  const candidates = [rule.speciesName, ...(rule.speciesAliases ?? [])].map(normalizeSpeciesLabel);
  return candidates.some(
    (candidate) =>
      normalized === candidate ||
      normalized.includes(candidate) ||
      candidate.includes(normalized)
  );
}

function waterTypeMatchesRule(rule: SpeciesRuleConfig, waterType?: string | null): boolean {
  if (!waterType) return true;
  const normalized = waterType.toLowerCase();
  return rule.waterTypes.some((type) => type === normalized);
}

/** Parse angler-entered length strings like `18 in`, `45 cm`, `1'6"`. */
export function parseLengthToInches(length: string): number | null {
  const trimmed = length.trim().toLowerCase();
  if (!trimmed) return null;

  const feetInches = trimmed.match(/(\d+)\s*['′]\s*(\d+)?/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = Number(feetInches[2] ?? 0);
    if (Number.isFinite(feet) && Number.isFinite(inches)) {
      return feet * 12 + inches;
    }
  }

  const cmMatch = trimmed.match(/([\d.]+)\s*cm/);
  if (cmMatch) {
    const cm = Number(cmMatch[1]);
    return Number.isFinite(cm) ? cm / 2.54 : null;
  }

  const inchMatch = trimmed.match(/([\d.]+)\s*(?:in|inch|inches|")/);
  if (inchMatch) {
    const inches = Number(inchMatch[1]);
    return Number.isFinite(inches) ? inches : null;
  }

  const numericOnly = trimmed.match(/^([\d.]+)$/);
  if (numericOnly) {
    const inches = Number(numericOnly[1]);
    return Number.isFinite(inches) ? inches : null;
  }

  return null;
}

function findSpeciesRule(
  stateCode: string | null,
  speciesName: string,
  waterType?: string | null
): SpeciesRuleConfig | null {
  if (!stateCode || !speciesName.trim()) return null;

  return (
    data.speciesRules.find(
      (rule) =>
        rule.states.includes(stateCode) &&
        waterTypeMatchesRule(rule, waterType) &&
        speciesMatchesRule(rule, speciesName)
    ) ?? null
  );
}

function buildSizeCheck(length: string, minSizeInches?: number): CatchSizeCheck | null {
  if (minSizeInches == null) return null;

  const enteredInches = parseLengthToInches(length);
  return {
    enteredInches,
    minSizeInches,
    passes: enteredInches == null ? null : enteredInches >= minSizeInches,
  };
}

function highestSeverity(notices: RegulationNotice[]): RegulationSeverity {
  if (notices.some((notice) => notice.severity === 'closed')) return 'closed';
  if (notices.some((notice) => notice.severity === 'warning')) return 'warning';
  return 'info';
}

export function getCatchRegulationCheck(options: {
  latitude: number | null;
  longitude: number | null;
  speciesName?: string;
  waterType?: string | null;
  length?: string;
  month?: number;
}): CatchRegulationCheck {
  const {
    latitude,
    longitude,
    speciesName = '',
    waterType = null,
    length = '',
    month = getCurrentMonth(),
  } = options;

  const notices: RegulationNotice[] = [];
  let seasonStatus: CatchRegulationSeasonStatus = 'unknown';
  let sizeCheck: CatchSizeCheck | null = null;
  let bagLimit: number | null = null;
  let bagLimitNote: string | null = null;
  let regulationsUrl: string | null = data.fallback.regulationsUrl;

  if (latitude == null || longitude == null) {
    notices.push({
      id: 'catch-no-location',
      severity: 'info',
      title: 'Location needed for local rules',
      message:
        'Enable GPS or log from a map spot to check seasons, size limits, and protected areas.',
      regulationsUrl: data.fallback.regulationsUrl,
    });

    return {
      status: 'info',
      notices,
      seasonStatus,
      sizeCheck: null,
      bagLimit: null,
      bagLimitNote: null,
      regulationsUrl,
    };
  }

  const stateCode = getStateFromCoordinates(latitude, longitude);
  const waterCategory = getWaterCategory(waterType ?? 'freshwater');
  const protectedArea = isNearProtectedArea(latitude, longitude);
  if (protectedArea) {
    const stateConfig = data.states[protectedArea.state];
    regulationsUrl = stateConfig?.regulationsUrl ?? regulationsUrl;
    notices.push({
      id: `protected-${protectedArea.id}`,
      severity: protectedArea.severity,
      title: protectedArea.name,
      message: protectedArea.message,
      regulationsUrl,
    });
  }

  if (stateCode && data.states[stateCode]) {
    const state = data.states[stateCode];
    regulationsUrl = state.regulationsUrl;
    appendLicenseNotice(notices, stateCode, waterCategory);
  } else if (!stateCode) {
    notices.push({
      id: 'fallback-regulations',
      severity: 'info',
      title: data.fallback.title,
      message: data.fallback.message,
      regulationsUrl: data.fallback.regulationsUrl,
    });
  }

  const speciesRule = findSpeciesRule(stateCode, speciesName, waterType);
  if (speciesRule) {
    if (speciesRule.closedMonths.includes(month)) {
      seasonStatus = 'closed';
      notices.push({
        id: `season-closed-${speciesRule.speciesName}`,
        severity: 'warning',
        title: `${speciesName} may be out of season`,
        message: speciesRule.message,
        regulationsUrl,
      });
    } else {
      seasonStatus = 'open';
    }

    sizeCheck = buildSizeCheck(length, speciesRule.minSizeInches);
    if (sizeCheck?.passes === false) {
      notices.push({
        id: `size-limit-${speciesRule.speciesName}`,
        severity: 'warning',
        title: 'Possible size limit issue',
        message: `Entered length is below the ${sizeCheck.minSizeInches} in reference minimum for ${speciesName}. ${speciesRule.message}`,
        regulationsUrl,
      });
    }

    bagLimit = speciesRule.bagLimit ?? null;
    bagLimitNote = speciesRule.bagLimitNote ?? null;

    if (seasonStatus === 'open' && sizeCheck?.passes !== false) {
      notices.push({
        id: `species-guidance-${speciesRule.speciesName}`,
        severity: 'info',
        title: `${speciesName} regulations`,
        message: speciesRule.message,
        regulationsUrl,
      });
    }
  } else if (speciesName.trim()) {
    notices.push({
      id: 'species-verify',
      severity: 'info',
      title: 'Verify species rules',
      message:
        'We do not have detailed keep limits for this species here yet. Check official regulations before keeping fish.',
      regulationsUrl,
    });
  }

  const uniqueNotices = sortNotices(
    notices.filter((notice, index, array) => array.findIndex((item) => item.id === notice.id) === index)
  );

  return {
    status: highestSeverity(uniqueNotices),
    notices: uniqueNotices,
    seasonStatus,
    sizeCheck,
    bagLimit,
    bagLimitNote,
    regulationsUrl,
  };
}
