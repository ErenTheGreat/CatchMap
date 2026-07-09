import type {
  CurrentConditionsSnapshot,
  PersonalBiteBoost,
  PersonalBiteFactor,
  PersonalBiteFingerprint,
  SpeciesBitePattern,
  BiteFactorCategory,
} from '@/lib/types/personalBite';
import { MIN_CATCHES_FOR_FINGERPRINT } from '@/lib/types/personalBite';
import type { CatchRecord } from '@/utils/storage';
import { formatCatchHourLabel } from '@/lib/types/spotDetails';

type FactorKey = `${BiteFactorCategory}:${string}`;

interface FactorAccumulator {
  category: BiteFactorCategory;
  value: string;
  label: string;
  count: number;
}

function getCatchHour(c: CatchRecord): number {
  const ts = c.createdAt || new Date(c.date).getTime();
  return new Date(ts).getHours();
}

function getHourBucket(hour: number): { value: string; label: string } {
  if (hour >= 5 && hour < 9) return { value: 'dawn', label: 'Dawn (5–9 AM)' };
  if (hour >= 9 && hour < 12) return { value: 'morning', label: 'Morning (9 AM–12 PM)' };
  if (hour >= 12 && hour < 17) return { value: 'midday', label: 'Midday (12–5 PM)' };
  if (hour >= 17 && hour < 21) return { value: 'dusk', label: 'Dusk (5–9 PM)' };
  return { value: 'night', label: 'Night (9 PM–5 AM)' };
}

function getWindBand(mph: number | undefined): { value: string; label: string } | null {
  if (mph == null) return null;
  if (mph < 5) return { value: 'calm', label: 'Calm wind (<5 mph)' };
  if (mph < 12) return { value: 'light', label: 'Light wind (5–12 mph)' };
  if (mph < 20) return { value: 'moderate', label: 'Moderate wind (12–20 mph)' };
  return { value: 'strong', label: 'Strong wind (20+ mph)' };
}

function addFactor(
  map: Map<FactorKey, FactorAccumulator>,
  category: BiteFactorCategory,
  value: string,
  label: string
): void {
  const key: FactorKey = `${category}:${value}`;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    map.set(key, { category, value, label, count: 1 });
  }
}

function accumulateFactorsFromCatch(
  map: Map<FactorKey, FactorAccumulator>,
  catchRecord: CatchRecord
): void {
  const hour = getCatchHour(catchRecord);
  const bucket = getHourBucket(hour);
  addFactor(map, 'hour', bucket.value, bucket.label);

  const conditions = catchRecord.conditions;
  if (!conditions) return;

  if (conditions.pressureTrend) {
    const labels: Record<string, string> = {
      falling: 'Falling barometric pressure',
      rising: 'Rising barometric pressure',
      stable: 'Stable barometric pressure',
    };
    addFactor(
      map,
      'pressureTrend',
      conditions.pressureTrend,
      labels[conditions.pressureTrend] ?? conditions.pressureTrend
    );
  }

  if (conditions.skyLabel) {
    addFactor(map, 'sky', conditions.skyLabel.toLowerCase(), conditions.skyLabel);
  }

  const wind = getWindBand(conditions.windSpeedMph);
  if (wind) {
    addFactor(map, 'wind', wind.value, wind.label);
  }

  if (conditions.moonPhaseLabel) {
    addFactor(map, 'moon', conditions.moonPhaseLabel.toLowerCase(), conditions.moonPhaseLabel);
  }
}

function factorsFromMap(map: Map<FactorKey, FactorAccumulator>, limit = 4): PersonalBiteFactor[] {
  const total = [...map.values()].reduce((sum, f) => sum + f.count, 0);
  if (total === 0) return [];

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((f) => ({
      category: f.category,
      value: f.value,
      label: f.label,
      weight: f.count / total,
      catchCount: f.count,
    }));
}

function buildHeadline(factors: PersonalBiteFactor[], species?: string): string {
  if (factors.length === 0) {
    return species
      ? `Keep logging ${species} with conditions to unlock your pattern.`
      : 'Keep logging catches with conditions to unlock your pattern.';
  }

  const top = factors.slice(0, 3).map((f) => f.label.toLowerCase());
  const prefix = species ? `Your best ${species} window:` : 'Your best fishing window:';
  return `${prefix} ${top.join(' + ')}.`;
}

function buildSpeciesPatterns(
  catches: CatchRecord[],
  minPerSpecies = 3
): SpeciesBitePattern[] {
  const bySpecies = new Map<string, CatchRecord[]>();
  for (const c of catches) {
    if (!c.conditions) continue;
    const key = c.species.trim();
    if (!key) continue;
    const list = bySpecies.get(key) ?? [];
    list.push(c);
    bySpecies.set(key, list);
  }

  return [...bySpecies.entries()]
    .filter(([, list]) => list.length >= minPerSpecies)
    .map(([species, list]) => {
      const map = new Map<FactorKey, FactorAccumulator>();
      for (const c of list) {
        accumulateFactorsFromCatch(map, c);
      }
      const topFactors = factorsFromMap(map, 3);
      return {
        species,
        catchCount: list.length,
        topFactors,
        headline: buildHeadline(topFactors, species),
      };
    })
    .sort((a, b) => b.catchCount - a.catchCount)
    .slice(0, 5);
}

export function buildPersonalBiteFingerprint(catches: CatchRecord[]): PersonalBiteFingerprint {
  const withConditions = catches.filter((c) => c.conditions);
  const total = withConditions.length;
  const unlocked = total >= MIN_CATCHES_FOR_FINGERPRINT;

  if (!unlocked) {
    return {
      unlocked: false,
      catchesUntilUnlock: MIN_CATCHES_FOR_FINGERPRINT - total,
      totalCatchesWithConditions: total,
      topFactors: [],
      headline: `Log ${MIN_CATCHES_FOR_FINGERPRINT - total} more catches with weather conditions to unlock your personal bite fingerprint.`,
      speciesPatterns: [],
    };
  }

  const map = new Map<FactorKey, FactorAccumulator>();
  for (const c of withConditions) {
    accumulateFactorsFromCatch(map, c);
  }

  const topFactors = factorsFromMap(map, 4);
  const speciesPatterns = buildSpeciesPatterns(withConditions);

  return {
    unlocked: true,
    catchesUntilUnlock: 0,
    totalCatchesWithConditions: total,
    topFactors,
    headline: buildHeadline(topFactors),
    speciesPatterns,
  };
}

function conditionMatchesFactor(
  snapshot: CurrentConditionsSnapshot,
  factor: PersonalBiteFactor
): boolean {
  const { conditions, hour } = snapshot;

  switch (factor.category) {
    case 'hour': {
      if (hour == null) return false;
      return getHourBucket(hour).value === factor.value;
    }
    case 'pressureTrend':
      return conditions?.pressureTrend === factor.value;
    case 'sky':
      return conditions?.skyLabel?.toLowerCase() === factor.value;
    case 'wind': {
      const band = getWindBand(conditions?.windSpeedMph);
      return band?.value === factor.value;
    }
    case 'moon':
      return conditions?.moonPhaseLabel?.toLowerCase() === factor.value;
    default:
      return false;
  }
}

/** Score how well current conditions match the user's personal bite fingerprint (0–100). */
export function computePersonalPatternMatch(
  fingerprint: PersonalBiteFingerprint,
  snapshot: CurrentConditionsSnapshot,
  species?: string
): number {
  if (!fingerprint.unlocked) return 0;

  const factors =
    species != null
      ? fingerprint.speciesPatterns.find(
          (p) => p.species.toLowerCase() === species.toLowerCase()
        )?.topFactors ?? fingerprint.topFactors
      : fingerprint.topFactors;

  if (factors.length === 0) return 0;

  let matchedWeight = 0;
  let totalWeight = 0;
  for (const factor of factors) {
    totalWeight += factor.weight;
    if (conditionMatchesFactor(snapshot, factor)) {
      matchedWeight += factor.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((matchedWeight / totalWeight) * 100);
}

/** Personal boost for bite scoring when current conditions match fingerprint. */
export function computePersonalBiteBoost(
  fingerprint: PersonalBiteFingerprint,
  snapshot: CurrentConditionsSnapshot,
  species?: string
): PersonalBiteBoost {
  const factors =
    species != null
      ? fingerprint.speciesPatterns.find(
          (p) => p.species.toLowerCase() === species.toLowerCase()
        )?.topFactors ?? fingerprint.topFactors
      : fingerprint.topFactors;

  const matchingFactors = factors.filter((f) => conditionMatchesFactor(snapshot, f));
  const matchPct = computePersonalPatternMatch(fingerprint, snapshot, species);
  const boost = matchPct >= 50 ? Math.min(0.6, (matchPct / 100) * 0.6) : 0;

  return { boost, matchingFactors };
}

export function getMatchingFactorLabels(
  fingerprint: PersonalBiteFingerprint,
  snapshot: CurrentConditionsSnapshot,
  limit = 3
): string[] {
  const factors = fingerprint.topFactors.filter((f) => conditionMatchesFactor(snapshot, f));
  return factors.slice(0, limit).map((f) => f.label);
}

/** For tests / display — hour bucket from clock hour. */
export function getHourBucketLabel(hour: number): string {
  return getHourBucket(hour).label;
}

export function getHourBucketValue(hour: number): string {
  return getHourBucket(hour).value;
}

export { formatCatchHourLabel };
