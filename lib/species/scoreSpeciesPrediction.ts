import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { dedupeAvailableSpecies } from '@/lib/api/endpoints/speciesPrediction';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import {
  classifySkyCondition,
  formatSkyConditionLabel,
  type ActivityRating,
  type AvailableSpecies,
  type CatchActivityRow,
  type PredictionFactor,
  type PredictionFactorImpact,
  type SpeciesPrediction,
  type SpeciesPredictionResult,
  type SpotContext,
} from '@/lib/types/speciesPrediction';
function getSeason(month: number, hemisphere: 'Northern' | 'Southern'): Season {
  const adjustedMonth = hemisphere === 'Southern' ? ((month + 5) % 12) + 1 : month;
  if (adjustedMonth >= 3 && adjustedMonth <= 5) return 'Spring';
  if (adjustedMonth >= 6 && adjustedMonth <= 8) return 'Summer';
  if (adjustedMonth >= 9 && adjustedMonth <= 11) return 'Fall';
  return 'Winter';
}

export const MIN_PROBABILITY = 15;
export const MAX_SPECIES_DISPLAY = 8;

type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

const WEIGHTS = {
  waterTemp: 0.25,
  weather: 0.2,
  timeOfDay: 0.15,
  habitat: 0.15,
  community: 0.15,
  personal: 0.1,
} as const;

interface FactorScore {
  contribution: number;
  factor: PredictionFactor;
}

export interface ScoreSpeciesPredictionsInput {
  species: AvailableSpecies[];
  weather: WeatherSnapshot | null | undefined;
  spotContext: SpotContext | null;
  latitude: number | null;
  longitude: number | null;
  catchActivity: CatchActivityRow[];
  personalSpecies: PersonalSpeciesNear[];
  tides: TidePrediction[] | null;
  currentMonth?: number;
  now?: Date;
}

function monthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function isInSeason(species: AvailableSpecies, month: number): boolean {
  if (monthInRange(month, species.monthStart, species.monthEnd)) {
    return true;
  }
  if (species.peakMonths?.includes(month)) {
    return true;
  }
  return false;
}

function getSolarPeriod(
  now: Date,
  weather: Pick<WeatherSnapshot, 'sunrise' | 'sunset' | 'civilTwilightBegin' | 'civilTwilightEnd'> | null | undefined
): { period: string; isPrime: boolean } {
  if (!weather?.sunrise || !weather?.sunset) {
    const hour = now.getHours();
    if (hour >= 5 && hour < 9) return { period: 'Dawn Bite', isPrime: true };
    if (hour >= 9 && hour < 12) return { period: 'Morning', isPrime: false };
    if (hour >= 12 && hour < 17) return { period: 'Midday Lull', isPrime: false };
    if (hour >= 17 && hour < 21) return { period: 'Evening Bite', isPrime: true };
    return { period: 'Night', isPrime: false };
  }

  const ms = now.getTime();
  const sunrise = new Date(weather.sunrise).getTime();
  const sunset = new Date(weather.sunset).getTime();
  const twilightEnd = weather.civilTwilightEnd
    ? new Date(weather.civilTwilightEnd).getTime()
    : sunset + 30 * 60 * 1000;
  const twilightBegin = weather.civilTwilightBegin
    ? new Date(weather.civilTwilightBegin).getTime()
    : sunrise - 30 * 60 * 1000;

  const dawnStart = sunrise - 30 * 60 * 1000;
  const dawnEnd = sunrise + 90 * 60 * 1000;
  const eveningStart = sunset - 2 * 60 * 60 * 1000;
  const eveningEnd = sunset + 30 * 60 * 1000;
  const solarNoon = (sunrise + sunset) / 2;
  const middayStart = solarNoon + 2 * 60 * 60 * 1000;
  const middayEnd = sunset - 3 * 60 * 60 * 1000;

  if (ms >= dawnStart && ms < dawnEnd) return { period: 'Dawn Bite', isPrime: true };
  if (ms >= eveningStart && ms < eveningEnd) return { period: 'Evening Bite', isPrime: true };
  if (ms >= twilightEnd || ms < twilightBegin) return { period: 'Night', isPrime: false };
  if (ms >= middayStart && ms < middayEnd) return { period: 'Midday Lull', isPrime: false };
  return { period: 'Morning', isPrime: false };
}

function estimateWaterTempF(
  airTempF: number,
  season: Season,
  avgDepthFeet: number
): number {
  const seasonalMid: Record<Season, number> = {
    Spring: 60,
    Summer: 76,
    Fall: 63,
    Winter: 43,
  };
  const seasonMid = seasonalMid[season];
  const depthFactor = Math.min(Math.max(avgDepthFeet, 0) / 40, 1);
  const airInfluence = 1 - depthFactor * 0.6;
  return airInfluence * airTempF + (1 - airInfluence) * seasonMid;
}

function scoreWaterTemp(
  species: AvailableSpecies,
  waterTempF: number
): FactorScore {
  const weight = WEIGHTS.waterTemp;
  if (species.idealTempMin == null || species.idealTempMax == null) {
    return {
      contribution: 0.55,
      factor: {
        name: 'Water temperature',
        impact: 'neutral',
        detail: `Est. ${Math.round(waterTempF)}°F — limited species data`,
        weight,
      },
    };
  }

  const tempC = ((waterTempF - 32) * 5) / 9;
  if (tempC >= species.idealTempMin && tempC <= species.idealTempMax) {
    return {
      contribution: 1,
      factor: {
        name: 'Water temperature',
        impact: '+',
        detail: `Est. ${Math.round(waterTempF)}°F — ideal range`,
        weight,
      },
    };
  }

  const lowDelta = species.idealTempMin - tempC;
  const highDelta = tempC - species.idealTempMax;
  const outsideBy = Math.max(lowDelta, highDelta, 0);

  if (outsideBy <= 3) {
    return {
      contribution: 0.65,
      factor: {
        name: 'Water temperature',
        impact: 'neutral',
        detail: `Est. ${Math.round(waterTempF)}°F — near ideal`,
        weight,
      },
    };
  }

  if (outsideBy <= 8) {
    return {
      contribution: 0.35,
      factor: {
        name: 'Water temperature',
        impact: '-',
        detail: `Est. ${Math.round(waterTempF)}°F — outside ideal range`,
        weight,
      },
    };
  }

  return {
    contribution: 0.1,
    factor: {
      name: 'Water temperature',
      impact: '-',
      detail: `Est. ${Math.round(waterTempF)}°F — poor match`,
      weight,
    },
  };
}

function scoreWeather(
  species: AvailableSpecies,
  weather: WeatherSnapshot
): FactorScore {
  const weight = WEIGHTS.weather;
  const sky = classifySkyCondition(weather);
  let contribution = 0.6;
  let impact: PredictionFactorImpact = 'neutral';
  let detail = `${formatSkyConditionLabel(sky)}, ${Math.round(weather.windSpeedMph)} mph wind`;

  if (species.feedingZone === 'surface') {
    if (sky === 'Stormy') {
      contribution = 0.1;
      impact = '-';
      detail = 'Stormy — surface feeders retreat';
    } else if (sky === 'Rainy') {
      contribution = 0.35;
      impact = '-';
      detail = 'Rainy — tough for surface feeders';
    } else if (sky === 'Clear' && weather.windSpeedMph < 12) {
      contribution = 1;
      impact = '+';
      detail = 'Clear and calm — great for surface feeders';
    }
  } else if (species.feedingZone === 'bottom') {
    if (sky === 'Rainy' || sky === 'Cloudy') {
      contribution = 0.9;
      impact = '+';
      detail = 'Overcast/rain — bottom feeders active';
    } else if (sky === 'Stormy') {
      contribution = 0.25;
      impact = '-';
      detail = 'Stormy — difficult conditions';
    }
  }

  if (weather.pressureTrend === 'falling' && contribution > 0.2) {
    contribution = Math.min(1, contribution + 0.15);
    detail += ' · falling pressure';
    if (impact === 'neutral') impact = '+';
  } else if (weather.pressureTrend === 'rising' && contribution > 0.5) {
    contribution = Math.max(0.2, contribution - 0.1);
  }

  if (weather.windSpeedMph >= 20 && species.feedingZone !== 'bottom') {
    contribution = Math.max(0.15, contribution - 0.25);
    impact = '-';
    detail = `Strong wind (${Math.round(weather.windSpeedMph)} mph)`;
  }

  return {
    contribution,
    factor: { name: 'Current weather', impact, detail, weight },
  };
}

function scoreTimeOfDay(
  species: AvailableSpecies,
  period: string,
  isPrime: boolean
): FactorScore {
  const weight = WEIGHTS.timeOfDay;
  const nocturnal = species.nocturnal ?? false;

  if (nocturnal) {
    if (period === 'Night') {
      return {
        contribution: 1,
        factor: {
          name: 'Time of day',
          impact: '+',
          detail: 'Night — peak for nocturnal species',
          weight,
        },
      };
    }
    if (period === 'Midday Lull') {
      return {
        contribution: 0.2,
        factor: {
          name: 'Time of day',
          impact: '-',
          detail: 'Midday — nocturnal species inactive',
          weight,
        },
      };
    }
    return {
      contribution: 0.45,
      factor: {
        name: 'Time of day',
        impact: 'neutral',
        detail: `${period} — moderate for nocturnal species`,
        weight,
      },
    };
  }

  if (isPrime) {
    return {
      contribution: 1,
      factor: {
        name: 'Time of day',
        impact: '+',
        detail: `${period} — prime feeding window`,
        weight,
      },
    };
  }

  if (period === 'Midday Lull') {
    const contribution = species.feedingZone === 'bottom' ? 0.55 : 0.25;
    return {
      contribution,
      factor: {
        name: 'Time of day',
        impact: species.feedingZone === 'bottom' ? 'neutral' : '-',
        detail: 'Midday lull — fish less active',
        weight,
      },
    };
  }

  if (period === 'Night') {
    return {
      contribution: 0.3,
      factor: {
        name: 'Time of day',
        impact: '-',
        detail: 'Night — most species slow down',
        weight,
      },
    };
  }

  return {
    contribution: 0.65,
    factor: {
      name: 'Time of day',
      impact: 'neutral',
      detail: period,
      weight,
    },
  };
}

function scoreHabitat(
  species: AvailableSpecies,
  spotContext: SpotContext | null
): FactorScore {
  const weight = WEIGHTS.habitat;

  if (!spotContext) {
    return {
      contribution: 0.5,
      factor: {
        name: 'Habitat match',
        impact: 'neutral',
        detail: 'No spot habitat data',
        weight,
      },
    };
  }

  let contribution = 0.5;
  let impact: PredictionFactorImpact = 'neutral';
  const details: string[] = [];

  const spotWater = spotContext.waterType.toLowerCase();
  const speciesWaters = (species.waterTypes ?? []).map((w) => w.toLowerCase());

  if (speciesWaters.length > 0) {
    const matchesWater = speciesWaters.some((w) => {
      if (w === 'lake') return /lake|reservoir|pond|pit/.test(spotWater);
      if (w === 'river') return /river|creek|stream/.test(spotWater);
      if (w === 'pond') return /pond|lake|reservoir|urban/.test(spotWater);
      return spotWater.includes(w);
    });
    if (matchesWater) {
      contribution += 0.25;
      impact = '+';
      details.push('water type match');
    } else {
      contribution -= 0.2;
      impact = '-';
      details.push('water type mismatch');
    }
  }

  const depth = spotContext.avgDepthFeet;
  const deepSpecies = /striped|kokanee|halibut|shark|ray/i.test(species.name);
  const shallowSpecies = /bluegill|sunfish|crappie|green sunfish/i.test(species.name);

  if (depth >= 30 && deepSpecies) {
    contribution += 0.2;
    details.push(`deep water (${depth} ft)`);
    if (impact !== '-') impact = '+';
  } else if (depth <= 10 && shallowSpecies) {
    contribution += 0.2;
    details.push(`shallow water (${depth} ft)`);
    if (impact !== '-') impact = '+';
  } else if (depth >= 40 && shallowSpecies) {
    contribution -= 0.15;
    details.push('deep water — less ideal for panfish');
    impact = '-';
  }

  if (spotContext.isSaltwater !== /halibut|shark|ray|striped/i.test(species.name)) {
    if (spotContext.isSaltwater && !/halibut|shark|ray|striped/i.test(species.name)) {
      contribution = Math.min(contribution, 0.15);
      impact = '-';
      details.push('freshwater species in saltwater spot');
    }
  }

  contribution = Math.max(0, Math.min(1, contribution));

  return {
    contribution,
    factor: {
      name: 'Habitat match',
      impact,
      detail: details.length > 0 ? details.join(' · ') : spotContext.waterType,
      weight,
    },
  };
}

function scoreCommunity(
  species: AvailableSpecies,
  catchActivity: CatchActivityRow[]
): FactorScore {
  const weight = WEIGHTS.community;
  const match = catchActivity.find(
    (row) =>
      row.speciesId === species.id ||
      row.speciesName.toLowerCase() === species.name.toLowerCase()
  );

  if (!match || match.catchCount <= 0) {
    return {
      contribution: 0.4,
      factor: {
        name: 'Community catches',
        impact: 'neutral',
        detail: 'No recent catches logged nearby',
        weight,
      },
    };
  }

  const maxCount = Math.max(...catchActivity.map((r) => r.catchCount), 1);
  const ratio = match.catchCount / maxCount;
  const contribution = 0.35 + ratio * 0.65;

  return {
    contribution,
    factor: {
      name: 'Community catches',
      impact: '+',
      detail: `${match.catchCount} catch${match.catchCount === 1 ? '' : 'es'} nearby (90 days)`,
      weight,
    },
  };
}

function scorePersonal(
  species: AvailableSpecies,
  personalSpecies: PersonalSpeciesNear[]
): FactorScore {
  const weight = WEIGHTS.personal;
  const match = personalSpecies.find(
    (row) => row.species.toLowerCase() === species.name.toLowerCase()
  );

  if (!match || match.count <= 0) {
    return {
      contribution: 0.45,
      factor: {
        name: 'Your history',
        impact: 'neutral',
        detail: 'No personal catches at this spot',
        weight,
      },
    };
  }

  const maxCount = Math.max(...personalSpecies.map((r) => r.count), 1);
  const ratio = match.count / maxCount;

  return {
    contribution: 0.4 + ratio * 0.6,
    factor: {
      name: 'Your history',
      impact: '+',
      detail: `You caught ${match.count} here`,
      weight,
    },
  };
}

function getTideBonus(
  now: Date,
  tides: TidePrediction[] | null,
  isSaltwater: boolean
): { bonus: number; factor: PredictionFactor | null } {
  if (!isSaltwater || !tides || tides.length === 0) {
    return { bonus: 0, factor: null };
  }

  const hourMs = now.getTime();
  for (const tide of tides) {
    const tideMs = new Date(tide.time).getTime();
    const diffMs = tideMs - hourMs;

    if (Math.abs(diffMs) <= 30 * 60 * 1000) {
      return {
        bonus: -0.08,
        factor: {
          name: 'Tides',
          impact: '-',
          detail: 'Slack tide — less movement',
          weight: 0.05,
        },
      };
    }

    if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
      return {
        bonus: 0.12,
        factor: {
          name: 'Tides',
          impact: '+',
          detail: 'Moving tide — fish more active',
          weight: 0.05,
        },
      };
    }
  }

  return { bonus: 0, factor: null };
}

function peakMonthBonus(species: AvailableSpecies, month: number): number {
  if (species.peakMonths?.includes(month)) {
    return 0.08;
  }
  return 0;
}

function probabilityToRating(probability: number): ActivityRating {
  if (probability >= 70) return 'High';
  if (probability >= 40) return 'Moderate';
  return 'Low';
}

function computeWeightedProbability(factorScores: FactorScore[], tideBonus: number, peakBonus: number): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const { contribution, factor } of factorScores) {
    weightedSum += contribution * factor.weight;
    totalWeight += factor.weight;
  }

  const base = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  const adjusted = Math.max(0, Math.min(1, base + tideBonus + peakBonus));
  return Math.round(adjusted * 100);
}

function buildContextSubtitle(
  weather: WeatherSnapshot | null,
  period: string,
  season: Season
): string | null {
  if (!weather) return null;
  const sky = classifySkyCondition(weather);
  return `${formatSkyConditionLabel(sky)} · ${Math.round(weather.temperatureF)}°F · ${period} · ${season}`;
}

export function scoreSingleSpecies(
  species: AvailableSpecies,
  input: Omit<ScoreSpeciesPredictionsInput, 'species'>
): SpeciesPrediction | null {
  const now = input.now ?? new Date();
  const month = input.currentMonth ?? now.getMonth() + 1;

  if (!isInSeason(species, month)) {
    return null;
  }

  const latitude = input.latitude ?? 37.6;
  const season = getSeason(now.getMonth() + 1, latitude >= 0 ? 'Northern' : 'Southern');
  const { period, isPrime } = getSolarPeriod(now, input.weather ?? null);

  const avgDepth = input.spotContext?.avgDepthFeet ?? 20;
  const airTemp = input.weather?.temperatureF ?? 65;
  const waterTempF = estimateWaterTempF(airTemp, season, avgDepth);

  const factorScores: FactorScore[] = [
    scoreWaterTemp(species, waterTempF),
    input.weather
      ? scoreWeather(species, input.weather)
      : {
          contribution: 0.5,
          factor: {
            name: 'Current weather',
            impact: 'neutral',
            detail: 'Weather unavailable',
            weight: WEIGHTS.weather,
          },
        },
    scoreTimeOfDay(species, period, isPrime),
    scoreHabitat(species, input.spotContext),
    scoreCommunity(species, input.catchActivity),
    scorePersonal(species, input.personalSpecies),
  ];

  const { bonus: tideBonus, factor: tideFactor } = getTideBonus(
    now,
    input.tides,
    input.spotContext?.isSaltwater ?? false
  );
  if (tideFactor) {
    factorScores.push({ contribution: tideBonus > 0 ? 0.85 : 0.25, factor: tideFactor });
  }

  const peakBonus = peakMonthBonus(species, month);
  const probability = computeWeightedProbability(factorScores, tideBonus, peakBonus);
  const factors = factorScores.map((f) => f.factor);

  if (peakBonus > 0) {
    factors.unshift({
      name: 'Peak season',
      impact: '+',
      detail: 'Current month is peak for this species',
      weight: 0.05,
    });
  }

  return {
    ...species,
    probability,
    activityRating: probabilityToRating(probability),
    score: probability / 20,
    factors,
  };
}

export function scoreSpeciesPredictions(input: ScoreSpeciesPredictionsInput): SpeciesPredictionResult {
  const now = input.now ?? new Date();
  const latitude = input.latitude ?? 37.6;
  const season = getSeason(now.getMonth() + 1, latitude >= 0 ? 'Northern' : 'Southern');
  const { period } = getSolarPeriod(now, input.weather ?? null);

  const scoringContext = {
    weather: input.weather,
    spotContext: input.spotContext,
    latitude: input.latitude,
    longitude: input.longitude,
    catchActivity: input.catchActivity,
    personalSpecies: input.personalSpecies,
    tides: input.tides,
    currentMonth: input.currentMonth,
    now,
  };

  const predictions = dedupeAvailableSpecies(input.species)
    .map((item) => scoreSingleSpecies(item, scoringContext))
    .filter((item): item is SpeciesPrediction => item != null)
    .filter((item) => item.probability >= MIN_PROBABILITY)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, MAX_SPECIES_DISPLAY);

  if (!input.weather) {
    return {
      predictions: predictions.map((item) => ({
        ...item,
        activityRating: 'Moderate' as ActivityRating,
      })),
      skyCondition: null,
      temperatureF: null,
      spotContext: input.spotContext,
      contextSubtitle: input.spotContext ? `${input.spotContext.waterType} · ${season}` : null,
    };
  }

  return {
    predictions,
    skyCondition: classifySkyCondition(input.weather),
    temperatureF: input.weather.temperatureF,
    spotContext: input.spotContext,
    contextSubtitle: buildContextSubtitle(input.weather, period, season),
  };
}

/** @deprecated Use scoreSpeciesPredictions for multi-factor scoring. */
export function buildSpeciesPredictions(
  species: AvailableSpecies[],
  weather: WeatherSnapshot | null | undefined
): SpeciesPredictionResult {
  return scoreSpeciesPredictions({
    species,
    weather,
    spotContext: null,
    latitude: null,
    longitude: null,
    catchActivity: [],
    personalSpecies: [],
    tides: null,
  });
}
