import type {
  WeatherSnapshot,
  HourlyBiteForecast,
  HourlyWeatherPoint,
} from '@/lib/api/endpoints/weather';
import {
  getDailySunTimes,
  hasHourlyForecastForDate,
  selectHourlyForLocalDate,
  selectNext12Hours,
} from '@/lib/api/endpoints/weather';
import type { CatchTimeSlot } from '@/lib/types/spotDetails';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { FeedingZone, SpeciesPrediction, CatchActivityRow } from '@/lib/types/speciesPrediction';
import { getCommunityTopLures } from '@/utils/communityCatchIntel';
import {
  getFishingForecast,
  getActivityLabel,
  type ActivityRating,
  type TimeOfDay,
} from '@/utils/fishingEngine';
import { getSolunarBoost, getSolunarHighlight, getMoonDataFromWeather } from '@/utils/solunar';

export type FactorImpact = '+' | '-' | 'neutral';

export interface BestTimeFactor {
  name: string;
  impact: FactorImpact;
  detail: string;
}

export interface NextWindow {
  label: string;
  startsInMinutes: number;
}

export type DailyCurveIcon = 'night' | 'dawn' | 'day' | 'cloudy' | 'dusk' | 'prime';

export interface DailyBitePoint {
  time: string;
  hour: number;
  hourLabel: string;
  /** Continuous 1–5 activity score for a smooth curve. */
  score: number;
  rating: ActivityRating;
  period: string;
  icon: DailyCurveIcon;
  isNow: boolean;
  highlights: string[];
}

export interface DailyBiteCurve {
  points: DailyBitePoint[];
  bestHourIndex: number;
  worstHourIndex: number;
  nowIndex: number;
}

export interface SpeciesBestWindow {
  id: string;
  name: string;
  rating: ActivityRating;
  /** Concrete clock-time ranges, e.g. "5:40–7:10 AM". */
  windows: string[];
  /** Period names matching the windows, e.g. "Dawn". */
  periods: string[];
}

export interface BestTimeNowResult {
  activityRating: ActivityRating;
  label: string;
  period: string;
  summary: string;
  tip: string;
  factors: BestTimeFactor[];
  nextWindow?: NextWindow;
  recommendedLures: string[];
  /** Lures from anonymized angler logs near this spot; preferred over recommendedLures when present. */
  communityLures?: string[];
  solarTimeline?: {
    sunriseLabel: string;
    sunsetLabel: string;
    progress: number;
    nowLabel: string;
  };
  communityCatchTimes?: CatchTimeSlot[];
  personalCatchTimes?: CatchTimeSlot[];
  tideNote?: string;
  hourlyForecast: HourlyBiteForecast[];
  forecastSubtitle?: string;
  dailyCurve?: DailyBiteCurve;
  speciesBestTimes?: SpeciesBestWindow[];
}

const PERIOD_TIPS: Record<string, string> = {
  'Dawn Bite':
    'Prime fishing time! Fish are actively feeding in low light. Try topwater lures for bass, streamers for trout.',
  Morning:
    'Fish are transitioning — target structure and weed lines as activity spreads.',
  'Midday Lull':
    'Fish may be sluggish. Target deeper water, shade, or structure. Catfish and carp stay active.',
  'Evening Bite':
    'Second prime window! Fish move shallow to feed. Great for topwater and shallow crankbaits.',
  Night:
    'Catfish, walleye, and crappie dominate. Use live bait or glow-in-the-dark lures.',
};

function normalizeActivityRating(
  score: number,
  period: string,
  isPrime: boolean
): ActivityRating {
  let rating = score;

  if (isPrime) {
    rating += 0.5;
  }
  if (period === 'Midday Lull') {
    rating -= 0.5;
  }

  rating = Math.round(rating);

  if (period === 'Midday Lull' && rating > 3) {
    rating = 3;
  }

  return Math.max(1, Math.min(5, rating)) as ActivityRating;
}

/** Same adjustments as normalizeActivityRating but without rounding, for smooth curves. */
function normalizeActivityScoreContinuous(
  score: number,
  period: string,
  isPrime: boolean
): number {
  let value = score;
  if (isPrime) value += 0.5;
  if (period === 'Midday Lull') {
    value -= 0.5;
    if (value > 3) value = 3;
  }
  return Math.max(1, Math.min(5, value));
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

function computeNextWindow(
  now: Date,
  weather: Pick<WeatherSnapshot, 'sunrise' | 'sunset'> | null | undefined
): NextWindow | undefined {
  if (!weather?.sunrise || !weather?.sunset) return undefined;

  const ms = now.getTime();
  const sunrise = new Date(weather.sunrise).getTime();
  const sunset = new Date(weather.sunset).getTime();

  const windows: { label: string; start: number }[] = [
    { label: 'Dawn Bite', start: sunrise - 30 * 60 * 1000 },
    { label: 'Evening Bite', start: sunset - 2 * 60 * 60 * 1000 },
  ];

  for (const window of windows.sort((a, b) => a.start - b.start)) {
    if (window.start > ms) {
      return {
        label: window.label,
        startsInMinutes: Math.round((window.start - ms) / 60000),
      };
    }
  }

  const tomorrowDawn = sunrise + 24 * 60 * 60 * 1000 - 30 * 60 * 1000;
  return {
    label: 'Dawn Bite',
    startsInMinutes: Math.round((tomorrowDawn - ms) / 60000),
  };
}

function buildSolarTimeline(
  now: Date,
  weather: Pick<WeatherSnapshot, 'sunrise' | 'sunset'> | null | undefined
): BestTimeNowResult['solarTimeline'] {
  if (!weather?.sunrise || !weather?.sunset) return undefined;

  const sunrise = new Date(weather.sunrise);
  const sunset = new Date(weather.sunset);
  const dayStart = sunrise.getTime() - 60 * 60 * 1000;
  const dayEnd = sunset.getTime() + 60 * 60 * 1000;
  const span = dayEnd - dayStart;
  const progress = Math.max(0, Math.min(1, (now.getTime() - dayStart) / span));

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return {
    sunriseLabel: fmt(sunrise),
    sunsetLabel: fmt(sunset),
    progress,
    nowLabel: fmt(now),
  };
}

function scoreWeatherFactors(
  weather: WeatherSnapshot | null | undefined,
  isPrime: boolean,
  useLiveConditions = true
): { delta: number; factors: BestTimeFactor[] } {
  const factors: BestTimeFactor[] = [];
  let delta = 0;

  if (!weather || !useLiveConditions) return { delta, factors };

  if (isPrime) {
    factors.push({ name: 'Low light', impact: '+', detail: 'Prime feeding window' });
    delta += 1;
  }

  if (weather.windSpeedMph >= 20) {
    factors.push({
      name: 'Strong wind',
      impact: '-',
      detail: `${Math.round(weather.windSpeedMph)} mph — tough casting`,
    });
    delta -= 1;
  } else if (weather.windSpeedMph <= 8) {
    factors.push({ name: 'Light wind', impact: '+', detail: 'Calm surface conditions' });
    delta += 0.5;
  }

  if (weather.cloudCoverPercent >= 50 && weather.cloudCoverPercent < 90) {
    factors.push({
      name: 'Overcast',
      impact: '+',
      detail: 'Extended low-light — good for surface feeders',
    });
    delta += 0.5;
  }

  if (weather.precipitationInch >= 0.15) {
    factors.push({ name: 'Heavy rain', impact: '-', detail: 'Storm conditions' });
    delta -= 1.5;
  } else if (weather.precipitationInch >= 0.05) {
    factors.push({ name: 'Light rain', impact: '+', detail: 'Runoff can trigger a bite' });
    delta += 0.5;
  }

  if (weather.pressureTrend === 'falling') {
    factors.push({
      name: 'Falling pressure',
      impact: '+',
      detail: 'Front approaching — bite often picks up',
    });
    delta += 1;
  } else if (weather.pressureTrend === 'rising') {
    factors.push({
      name: 'Rising pressure',
      impact: 'neutral',
      detail: 'Post-front — fish may be finicky',
    });
    delta -= 0.5;
  }

  if (weather.temperatureF >= 85) {
    factors.push({ name: 'Hot weather', impact: '-', detail: 'Fish retreat deep midday' });
    delta -= 0.5;
  } else if (weather.temperatureF >= 55 && weather.temperatureF <= 75) {
    factors.push({ name: 'Ideal temps', impact: '+', detail: 'Active metabolism range' });
    delta += 0.5;
  }

  return { delta, factors };
}

function buildTideNote(
  tides: TidePrediction[] | null | undefined,
  now: Date
): string | undefined {
  if (!tides || tides.length === 0) return undefined;

  const nowMs = now.getTime();
  const sorted = tides
    .map((t) => ({ ...t, ms: new Date(t.time).getTime() }))
    .sort((a, b) => a.ms - b.ms);

  const upcoming = sorted.filter((t) => t.ms > nowMs);
  const next = upcoming[0];
  if (!next) return undefined;

  const mins = Math.round((next.ms - nowMs) / 60000);
  const slackSoon = mins <= 30;

  if (slackSoon) {
    const label = next.type === 'high' ? 'High tide' : 'Low tide';
    return `${label} in ${mins} min — slack water, fish may slow down`;
  }

  const movementLabel =
    next.type === 'high' ? 'Incoming tide — water rising' : 'Outgoing tide — water falling';
  const tideLabel = next.type === 'high' ? 'High tide' : 'Low tide';
  return `${tideLabel} in ${mins} min · ${movementLabel}`;
}

function hourTimeKey(time: string | Date): string {
  if (typeof time === 'string') return time.slice(0, 13);
  const year = time.getFullYear();
  const month = String(time.getMonth() + 1).padStart(2, '0');
  const day = String(time.getDate()).padStart(2, '0');
  const hour = String(time.getHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}`;
}

function findHourData(
  hourDate: Date,
  hourly?: HourlyWeatherPoint[]
): HourlyWeatherPoint | undefined {
  if (!hourly) return undefined;
  const key = hourTimeKey(hourDate);
  return hourly.find((point) => hourTimeKey(point.time) === key);
}

function scoreHourWeatherFactors(
  hourData: HourlyWeatherPoint,
  previousHourData: HourlyWeatherPoint | null,
  feedingZone?: FeedingZone
): { delta: number; highlights: string[] } {
  let delta = 0;
  const highlights: string[] = [];

  if (hourData.windSpeedMph >= 20) {
    delta -= 1;
    highlights.push('Strong wind');
  } else if (hourData.windSpeedMph <= 8) {
    delta += 0.5;
    highlights.push('Light wind');
  }

  if (hourData.cloudCoverPercent >= 50 && hourData.cloudCoverPercent < 90) {
    delta += feedingZone === 'surface' ? 0.75 : 0.5;
    highlights.push('Overcast');
  }

  if (hourData.precipitationInch >= 0.15) {
    delta -= 1.5;
    highlights.push('Heavy rain');
  } else if (hourData.precipitationInch >= 0.05) {
    delta += 0.5;
    highlights.push('Light rain');
  }

  if (previousHourData) {
    const pressureDelta = hourData.pressureMb - previousHourData.pressureMb;
    if (pressureDelta <= -1) {
      delta += 1;
      highlights.push('Falling pressure');
    } else if (pressureDelta >= 1) {
      delta -= 0.5;
      highlights.push('Rising pressure');
    }
  }

  if (hourData.temperatureF >= 85) {
    delta -= 0.5;
    highlights.push('Hot temps');
  } else if (hourData.temperatureF >= 55 && hourData.temperatureF <= 75) {
    delta += 0.5;
    highlights.push('Ideal temps');
  }

  return { delta, highlights };
}

function scoreSpeciesTemperature(
  temperatureF: number,
  species?: SpeciesPrediction
): number {
  if (!species?.idealTempMin || !species?.idealTempMax) return 0;

  const tempC = ((temperatureF - 32) * 5) / 9;
  if (tempC >= species.idealTempMin && tempC <= species.idealTempMax) {
    return 0.75;
  }
  if (tempC < species.idealTempMin - 5 || tempC > species.idealTempMax + 5) {
    return -0.75;
  }
  return 0;
}

function getTideBoost(hourDate: Date, tides?: TidePrediction[] | null): number {
  if (!tides || tides.length === 0) return 0;

  const hourMs = hourDate.getTime();

  for (const tide of tides) {
    const tideMs = new Date(tide.time).getTime();
    const diffMs = tideMs - hourMs;

    if (Math.abs(diffMs) <= 30 * 60 * 1000) {
      return -0.5;
    }

    if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
      return 1;
    }
  }

  return 0;
}

function getTideHighlight(hourDate: Date, tides?: TidePrediction[] | null): string | undefined {
  const boost = getTideBoost(hourDate, tides);
  if (boost > 0) return 'Moving tide';
  if (boost < 0) return 'Slack tide';
  return undefined;
}

function getCommunityCatchBoost(
  hourDate: Date,
  spotCatchTimes?: CatchTimeSlot[]
): number {
  if (!spotCatchTimes || spotCatchTimes.length === 0) return 0;
  const hour = hourDate.getHours();
  const match = spotCatchTimes.find((slot) => slot.hour === hour || slot.hour === hour % 24);
  return match && match.catchCount > 0 ? 1 : 0;
}

function getPersonalCatchBoost(
  hourDate: Date,
  personalCatchTimes?: CatchTimeSlot[]
): number {
  if (!personalCatchTimes || personalCatchTimes.length === 0) return 0;
  const hour = hourDate.getHours();
  const match = personalCatchTimes.find((slot) => slot.hour === hour || slot.hour === hour % 24);
  return match && match.catchCount > 0 ? 0.75 : 0;
}

interface ScoreHourResult {
  rating: ActivityRating;
  /** Continuous 1–5 score (un-rounded) for charting. */
  score: number;
  highlights: string[];
}

interface ScoreHourOptions {
  hourDate: Date;
  latitude: number;
  longitude: number;
  weather: WeatherSnapshot | null;
  hourData?: HourlyWeatherPoint;
  previousHourData?: HourlyWeatherPoint | null;
  tides?: TidePrediction[] | null;
  spotCatchTimes?: CatchTimeSlot[];
  personalCatchTimes?: CatchTimeSlot[];
  spotSpecies?: SpeciesPrediction[];
}

function scoreHour(options: ScoreHourOptions): ScoreHourResult {
  const {
    hourDate,
    latitude,
    longitude,
    weather,
    hourData,
    previousHourData = null,
    tides,
    spotCatchTimes,
    personalCatchTimes,
    spotSpecies,
  } = options;

  const { period, isPrime } = getSolarPeriod(hourDate, weather);
  const topSpecies = spotSpecies?.[0];
  const feedingZone = topSpecies?.feedingZone;
  const forecast = getFishingForecast(latitude, longitude, hourDate);
  const highlights: string[] = [];

  let score = topSpecies?.score ?? forecast.activeSpecies[0]?.activityRating ?? 3;

  if (isPrime) {
    score += feedingZone === 'surface' ? 1.5 : 1;
    highlights.push(period);
  }
  if (period === 'Midday Lull') {
    score -= feedingZone === 'bottom' ? 0.5 : 1;
  }

  const resolvedHourData = hourData ?? findHourData(hourDate, weather?.hourly);
  if (resolvedHourData) {
    const weatherResult = scoreHourWeatherFactors(
      resolvedHourData,
      previousHourData,
      feedingZone
    );
    score += weatherResult.delta;
    highlights.push(...weatherResult.highlights.slice(0, 2));

    if (topSpecies) {
      const tempBoost = scoreSpeciesTemperature(resolvedHourData.temperatureF, topSpecies);
      score += tempBoost;
      if (tempBoost > 0) highlights.push('Species temp match');
    }

    if (
      resolvedHourData.windSpeedMph >= 25 &&
      resolvedHourData.precipitationInch >= 0.25
    ) {
      score -= 1.25;
      highlights.push('Rough conditions');
    }
  }

  const tideBoost = getTideBoost(hourDate, tides);
  score += tideBoost;
  const tideHighlight = getTideHighlight(hourDate, tides);
  if (tideHighlight) highlights.push(tideHighlight);

  const moonData = getMoonDataFromWeather(weather);
  const solunarBoost = getSolunarBoost(hourDate, moonData, period);
  score += solunarBoost;
  const solunarHighlight = getSolunarHighlight(hourDate, moonData);
  if (solunarHighlight) highlights.push(solunarHighlight);

  if (getCommunityCatchBoost(hourDate, spotCatchTimes) > 0) {
    score += 1;
    highlights.push('Community catches');
  }
  if (getPersonalCatchBoost(hourDate, personalCatchTimes) > 0) {
    score += 0.75;
    highlights.push('Your best hour');
  }

  const rating = normalizeActivityRating(score, period, isPrime);
  const continuousScore = normalizeActivityScoreContinuous(score, period, isPrime);
  return { rating, score: continuousScore, highlights: highlights.slice(0, 3) };
}

export interface BuildHourlyBiteForecastOptions {
  latitude: number;
  longitude: number;
  weather: WeatherSnapshot | null;
  now?: Date;
  tides?: TidePrediction[] | null;
  spotCatchTimes?: CatchTimeSlot[];
  personalCatchTimes?: CatchTimeSlot[];
  spotSpecies?: SpeciesPrediction[];
  /** When set, scores the morning fishing window on this calendar day. */
  focusDate?: Date;
}

export function buildHourlyBiteForecast(
  latitude: number,
  longitude: number,
  weather: WeatherSnapshot | null,
  now: Date = new Date(),
  extras?: Omit<BuildHourlyBiteForecastOptions, 'latitude' | 'longitude' | 'weather' | 'now'>
): HourlyBiteForecast[] {
  const tides = extras?.tides;
  const spotCatchTimes = extras?.spotCatchTimes;
  const personalCatchTimes = extras?.personalCatchTimes;
  const spotSpecies = extras?.spotSpecies;
  const focusDate = extras?.focusDate;
  const scoringWeather = focusDate
    ? prepareWeatherForDate(weather, focusDate) ?? weather
    : weather;

  const buildSlot = (
    hourDate: Date,
    hourData: HourlyWeatherPoint | undefined,
    previousHourData: HourlyWeatherPoint | null,
    isNow: boolean
  ): HourlyBiteForecast => {
    const { period } = getSolarPeriod(hourDate, scoringWeather);
    const { rating, highlights } = scoreHour({
      hourDate,
      latitude,
      longitude,
      weather: scoringWeather,
      hourData,
      previousHourData,
      tides,
      spotCatchTimes,
      personalCatchTimes,
      spotSpecies,
    });

    return {
      time: hourData?.time ?? hourDate.toISOString(),
      hourLabel: isNow
        ? 'Now'
        : hourDate.toLocaleTimeString([], { hour: 'numeric' }),
      activityRating: rating,
      activityLabel: getActivityLabel(rating),
      period,
      isNow,
      highlights,
    };
  };

  const hourlySource = weather?.hourlyToday ?? weather?.hourly ?? [];

  if (focusDate) {
    const daySlots = selectHourlyForLocalDate(hourlySource, focusDate, 5, 14);
    if (daySlots.length > 0) {
      return daySlots.map((hourData, index) => {
        const hourDate = new Date(hourData.time);
        const previousHourData = index > 0 ? daySlots[index - 1] : null;
        const isNow = Math.abs(hourDate.getTime() - focusDate.getTime()) < 60 * 60 * 1000;
        return buildSlot(hourDate, hourData, previousHourData, isNow);
      });
    }

    const fallbackSlots: HourlyBiteForecast[] = [];
    const dayStart = new Date(focusDate);
    dayStart.setHours(5, 0, 0, 0);
    for (let hour = 5; hour < 14; hour++) {
      const hourDate = new Date(dayStart);
      hourDate.setHours(hour, 0, 0, 0);
      fallbackSlots.push(buildSlot(hourDate, undefined, null, hour === focusDate.getHours()));
    }
    return fallbackSlots;
  }

  if (weather?.hourly && weather.hourly.length > 0) {
    const slots = selectNext12Hours(weather.hourly, now);
    return slots.map((hourData, index) => {
      const hourDate = new Date(hourData.time);
      const previousHourData = index > 0 ? slots[index - 1] : null;
      return buildSlot(hourDate, hourData, previousHourData, index === 0);
    });
  }

  const results: HourlyBiteForecast[] = [];
  for (let i = 0; i < 12; i++) {
    const hourDate = new Date(now.getTime() + i * 60 * 60 * 1000);
    results.push(buildSlot(hourDate, undefined, null, i === 0));
  }
  return results;
}

function shiftClockTimeToDay(iso: string | undefined, day: Date): string | undefined {
  if (!iso) return undefined;
  const source = new Date(iso);
  if (Number.isNaN(source.getTime())) return undefined;
  const shifted = new Date(day);
  shifted.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), 0);
  return shifted.toISOString();
}

/**
 * Re-anchors sunrise/sunset onto the given day so hour-period classification
 * stays correct even when the weather snapshot is cached from a previous day.
 * Civil twilight fields are dropped on purpose: they are absolute instants that
 * can disagree with the timezone-naive sunrise/sunset strings, so getSolarPeriod
 * falls back to sunrise/sunset ± 30 min, which is always self-consistent.
 */
function alignSolarTimesToDay(
  weather: WeatherSnapshot | null,
  day: Date
): WeatherSnapshot | null {
  if (!weather) return weather;
  const daySun = getDailySunTimes(weather, day);
  const sunrise = daySun?.sunrise ?? weather.sunrise;
  const sunset = daySun?.sunset ?? weather.sunset;
  if (!sunrise || !sunset) return weather;
  return {
    ...weather,
    sunrise: shiftClockTimeToDay(sunrise, day),
    sunset: shiftClockTimeToDay(sunset, day),
    civilTwilightBegin: undefined,
    civilTwilightEnd: undefined,
  };
}

/**
 * Re-anchors solar times and overlays hour-specific forecast for trip planning.
 * Without hourly data for the target instant, current conditions are not reused.
 */
export function prepareWeatherForDate(
  weather: WeatherSnapshot | null,
  date: Date
): WeatherSnapshot | null {
  if (!weather) return null;

  const daySun = getDailySunTimes(weather, date);
  let prepared = alignSolarTimesToDay(
    {
      ...weather,
      sunrise: daySun?.sunrise ?? weather.sunrise,
      sunset: daySun?.sunset ?? weather.sunset,
    },
    date
  );
  if (!prepared) return null;

  const hourlySource = weather.hourlyToday ?? weather.hourly ?? [];
  const hourData = findHourData(date, hourlySource);
  if (!hourData) {
    return prepared;
  }

  const previousHourData =
    findHourData(new Date(date.getTime() - 60 * 60 * 1000), hourlySource) ?? null;

  let pressureTrend = weather.pressureTrend;
  if (previousHourData) {
    const pressureDelta = hourData.pressureMb - previousHourData.pressureMb;
    if (pressureDelta <= -1) pressureTrend = 'falling';
    else if (pressureDelta >= 1) pressureTrend = 'rising';
    else pressureTrend = 'stable';
  }

  return {
    ...prepared,
    temperatureF: hourData.temperatureF,
    windSpeedMph: hourData.windSpeedMph,
    precipitationInch: hourData.precipitationInch,
    pressureMb: hourData.pressureMb,
    cloudCoverPercent: hourData.cloudCoverPercent,
    pressureTrend,
  };
}

export function hasLiveForecastAt(
  weather: WeatherSnapshot | null | undefined,
  date: Date
): boolean {
  if (!weather) return false;
  const hourlySource = weather.hourlyToday ?? weather.hourly;
  return hasHourlyForecastForDate(hourlySource, date);
}

function getCurveIcon(
  period: string,
  rating: ActivityRating,
  cloudCoverPercent?: number
): DailyCurveIcon {
  if (period === 'Dawn Bite') return rating >= 4 ? 'prime' : 'dawn';
  if (period === 'Evening Bite') return rating >= 4 ? 'prime' : 'dusk';
  if (period === 'Night') return 'night';
  if (cloudCoverPercent != null && cloudCoverPercent >= 60) return 'cloudy';
  return 'day';
}

/**
 * Scores every hour of today (midnight to 11 PM) with the same multi-signal
 * engine used for the "now" rating, producing data for the day-long bite chart.
 */
export function buildDailyBiteCurve(
  latitude: number,
  longitude: number,
  rawWeather: WeatherSnapshot | null,
  now: Date = new Date(),
  extras?: Omit<BuildHourlyBiteForecastOptions, 'latitude' | 'longitude' | 'weather' | 'now'>
): DailyBiteCurve {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weather = alignSolarTimesToDay(rawWeather, dayStart);
  const hourlySource = weather?.hourlyToday ?? weather?.hourly;
  const nowHour = now.getHours();

  const points: DailyBitePoint[] = [];
  let previousHourData: HourlyWeatherPoint | null = null;

  for (let hour = 0; hour < 24; hour++) {
    const hourDate = new Date(dayStart.getTime() + hour * 60 * 60 * 1000);
    const hourData = findHourData(hourDate, hourlySource);
    const { period } = getSolarPeriod(hourDate, weather);
    const { rating, score, highlights } = scoreHour({
      hourDate,
      latitude,
      longitude,
      weather,
      hourData,
      previousHourData,
      tides: extras?.tides,
      spotCatchTimes: extras?.spotCatchTimes,
      personalCatchTimes: extras?.personalCatchTimes,
      spotSpecies: extras?.spotSpecies,
    });

    points.push({
      time: hourData?.time ?? hourDate.toISOString(),
      hour,
      hourLabel: hourDate.toLocaleTimeString([], { hour: 'numeric' }),
      score,
      rating,
      period,
      icon: getCurveIcon(period, rating, hourData?.cloudCoverPercent),
      isNow: hour === nowHour,
      highlights,
    });

    previousHourData = hourData ?? null;
  }

  let bestHourIndex = 0;
  let worstHourIndex = 0;
  points.forEach((point, index) => {
    if (point.score > points[bestHourIndex].score) bestHourIndex = index;
    if (point.score < points[worstHourIndex].score) worstHourIndex = index;
  });

  return { points, bestHourIndex, worstHourIndex, nowIndex: nowHour };
}

interface PeriodWindow {
  label: string;
  start: Date;
  end: Date;
}

function buildPeriodWindows(
  rawWeather: WeatherSnapshot | null,
  now: Date
): Record<TimeOfDay, PeriodWindow> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const atHour = (h: number, m = 0) =>
    new Date(dayStart.getTime() + h * 60 * 60 * 1000 + m * 60 * 1000);

  const weather = alignSolarTimesToDay(rawWeather, dayStart);
  const sunrise = weather?.sunrise ? new Date(weather.sunrise) : atHour(6);
  const sunset = weather?.sunset ? new Date(weather.sunset) : atHour(20);
  const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
  const minutes = (n: number) => n * 60 * 1000;

  return {
    Morning: {
      label: 'Dawn',
      start: new Date(sunrise.getTime() - minutes(30)),
      end: new Date(sunrise.getTime() + minutes(90)),
    },
    Midday: {
      label: 'Midday',
      start: new Date(solarNoon.getTime() - minutes(90)),
      end: new Date(solarNoon.getTime() + minutes(90)),
    },
    Evening: {
      label: 'Dusk',
      start: new Date(sunset.getTime() - minutes(120)),
      end: new Date(sunset.getTime() + minutes(30)),
    },
    Night: {
      label: 'Night',
      start: new Date(sunset.getTime() + minutes(60)),
      end: new Date(sunset.getTime() + minutes(240)),
    },
  };
}

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function deriveActiveTimesForPrediction(species: SpeciesPrediction): TimeOfDay[] {
  if (species.nocturnal) return ['Evening', 'Night'];
  switch (species.feedingZone) {
    case 'bottom':
      return ['Midday', 'Night'];
    case 'surface':
    case 'mid':
    default:
      return ['Morning', 'Evening'];
  }
}

/**
 * Maps each top species' preferred times of day to concrete clock-time windows
 * based on today's sunrise/sunset, e.g. "Largemouth Bass — 5:40–7:10 AM".
 */
export function getSpeciesBestWindows(options: {
  latitude: number;
  longitude: number;
  weather?: WeatherSnapshot | null;
  date?: Date;
  spotSpecies?: SpeciesPrediction[];
  limit?: number;
}): SpeciesBestWindow[] {
  const now = options.date ?? new Date();
  const limit = options.limit ?? 4;
  const periodWindows = buildPeriodWindows(options.weather ?? null, now);

  const toWindow = (
    id: string,
    name: string,
    rating: ActivityRating,
    activeTimes: TimeOfDay[]
  ): SpeciesBestWindow => {
    const slots = activeTimes.map((t) => periodWindows[t]);
    return {
      id,
      name,
      rating,
      windows: slots.map(
        (slot) => `${formatTimeShort(slot.start)}–${formatTimeShort(slot.end)}`
      ),
      periods: slots.map((slot) => slot.label),
    };
  };

  if (options.spotSpecies && options.spotSpecies.length > 0) {
    return options.spotSpecies
      .slice(0, limit)
      .map((species) =>
        toWindow(
          species.id,
          species.name,
          Math.max(1, Math.min(5, Math.round(species.score))) as ActivityRating,
          deriveActiveTimesForPrediction(species)
        )
      );
  }

  const forecast = getFishingForecast(options.latitude, options.longitude, now);
  return forecast.activeSpecies
    .filter((species) => species.activityRating >= 3)
    .slice(0, limit)
    .map((species) =>
      toWindow(species.id, species.name, species.activityRating, species.activeTimes)
    );
}

function buildForecastSubtitle(
  weather: WeatherSnapshot | null,
  nextWindow?: NextWindow
): string | undefined {
  const parts: string[] = [];
  if (weather?.moonPhaseLabel) {
    parts.push(weather.moonPhaseLabel);
  }
  if (nextWindow) {
    const mins = nextWindow.startsInMinutes;
    const timeLabel = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    parts.push(`${nextWindow.label} in ${timeLabel}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export interface ComputeBiteRawScoreOptions {
  latitude: number | null;
  longitude: number | null;
  weather?: WeatherSnapshot | null;
  date?: Date;
  spotCatchTimes?: CatchTimeSlot[];
  personalCatchTimes?: CatchTimeSlot[];
  tides?: TidePrediction[] | null;
  spotSpecies?: SpeciesPrediction[];
  /** Reduce shared weather/solunar influence when comparing many spots. */
  dampenSharedSignals?: boolean;
}

export function computeBiteRawScore(options: ComputeBiteRawScoreOptions): number {
  const now = options.date ?? new Date();
  const lat = options.latitude ?? 39.0;
  const lon = options.longitude ?? -98.0;
  const sourceWeather = options.weather ?? null;
  const preparedWeather = prepareWeatherForDate(sourceWeather, now);
  const weather = preparedWeather ?? sourceWeather;
  const dampenShared = options.dampenSharedSignals ?? false;
  const hasLiveHour = !!findHourData(now, sourceWeather?.hourlyToday ?? sourceWeather?.hourly);

  const { period, isPrime } = getSolarPeriod(now, weather);
  const forecast = getFishingForecast(lat, lon, now);
  const topSpecies = options.spotSpecies?.[0];
  let baseRating =
    topSpecies?.score ??
    forecast.activeSpecies.find((s) => s.peakNow)?.activityRating ??
    forecast.activeSpecies[0]?.activityRating ??
    3;

  if (dampenShared && topSpecies == null) {
    // Viewport pins share time-of-day/season — avoid marking every spot as peak.
    baseRating = 3 + (baseRating - 3) * 0.25;
  }

  const { delta } = scoreWeatherFactors(weather, isPrime, hasLiveHour);
  const moonData = getMoonDataFromWeather(weather);
  const solunarBoost = getSolunarBoost(now, moonData, period);
  const tideBoost = getTideBoost(now, options.tides);

  const currentHour = now.getHours();
  const matchingCatch = options.spotCatchTimes?.find(
    (s) => s.hour === currentHour || s.hour === currentHour % 24
  );
  const matchingPersonal = options.personalCatchTimes?.find(
    (s) => s.hour === currentHour || s.hour === currentHour % 24
  );

  const sharedMultiplier = dampenShared ? 0.4 : 1;
  let score =
    baseRating +
    delta * sharedMultiplier +
    solunarBoost * sharedMultiplier +
    tideBoost * sharedMultiplier;

  if (forecast.season === 'Spring' || forecast.season === 'Fall') {
    score += dampenShared ? 0.15 : 0.25;
  }
  if (matchingCatch && matchingCatch.catchCount > 0) score += 1;
  if (matchingPersonal && matchingPersonal.catchCount > 0) score += 0.75;
  if (isPrime) score += dampenShared ? 0.25 : 0.5;
  if (period === 'Midday Lull') score -= 0.75;

  if (!hasLiveHour) {
    // Solunar-only estimate — cap optimism when no hourly forecast exists for this day.
    score = Math.min(score, 4.2);
  }

  return score;
}

export function getTripDayOutlook(options: {
  latitude: number;
  longitude: number;
  weather: WeatherSnapshot | null;
  date: Date;
  tides?: TidePrediction[] | null;
}): {
  peakRating: ActivityRating;
  label: string;
  hasLiveForecast: boolean;
  note: string;
} {
  const hourly = buildHourlyBiteForecast(options.latitude, options.longitude, options.weather, options.date, {
    tides: options.tides,
    focusDate: options.date,
  });

  let peakRating: ActivityRating = 1;
  for (const slot of hourly) {
    if (slot.activityRating > peakRating) {
      peakRating = slot.activityRating;
    }
  }

  const hasLiveForecast = hasLiveForecastAt(options.weather, options.date);
  return {
    peakRating,
    label: getActivityLabel(peakRating),
    hasLiveForecast,
    note: hasLiveForecast
      ? 'Based on live hourly forecast for this day'
      : 'Solunar estimate only — hourly forecast not available this far out',
  };
}

export function getBestTimeNow(options: {
  latitude: number | null;
  longitude: number | null;
  weather?: WeatherSnapshot | null;
  date?: Date;
  spotCatchTimes?: CatchTimeSlot[];
  personalCatchTimes?: CatchTimeSlot[];
  tides?: TidePrediction[] | null;
  spotSpecies?: SpeciesPrediction[];
  communityCatchActivity?: CatchActivityRow[];
  tripPlanning?: boolean;
}): BestTimeNowResult {
  const now = options.date ?? new Date();
  const lat = options.latitude ?? 39.0;
  const lon = options.longitude ?? -98.0;
  const sourceWeather = options.weather ?? null;
  const weather = prepareWeatherForDate(sourceWeather, now) ?? sourceWeather;
  const hasLiveHour = !!findHourData(now, sourceWeather?.hourlyToday ?? sourceWeather?.hourly);
  const focusDate = options.tripPlanning ? now : undefined;

  const { period, isPrime } = getSolarPeriod(now, weather);
  const forecast = getFishingForecast(lat, lon, now);
  const topSpecies = options.spotSpecies?.[0];
  const baseRating =
    topSpecies?.score ??
    forecast.activeSpecies.find((s) => s.peakNow)?.activityRating ??
    forecast.activeSpecies[0]?.activityRating ??
    3;

  const { delta, factors } = scoreWeatherFactors(weather, isPrime, hasLiveHour);

  if (forecast.season === 'Spring' || forecast.season === 'Fall') {
    factors.push({
      name: `${forecast.season} season`,
      impact: '+',
      detail: 'Pre/post spawn activity peak',
    });
  }

  const moonData = getMoonDataFromWeather(weather);
  const solunarBoost = getSolunarBoost(now, moonData, period);
  if (solunarBoost > 0) {
    factors.push({
      name: 'Solunar period',
      impact: '+',
      detail: getSolunarHighlight(now, moonData) ?? 'Moon-influenced feeding window',
    });
  }

  const currentHour = now.getHours();
  const matchingCatch = options.spotCatchTimes?.find(
    (s) => s.hour === currentHour || s.hour === currentHour % 24
  );
  if (matchingCatch && matchingCatch.catchCount > 0) {
    factors.push({
      name: 'Community data',
      impact: '+',
      detail: `${matchingCatch.catchCount} catches logged at this hour nearby`,
    });
  }

  const matchingPersonal = options.personalCatchTimes?.find(
    (s) => s.hour === currentHour || s.hour === currentHour % 24
  );
  if (matchingPersonal && matchingPersonal.catchCount > 0) {
    factors.push({
      name: 'Your history',
      impact: '+',
      detail: `You usually catch fish around ${matchingPersonal.label}`,
    });
  }

  const tideBoost = getTideBoost(now, options.tides);
  if (tideBoost > 0) {
    factors.push({
      name: 'Moving tide',
      impact: '+',
      detail: 'Tidal flow often triggers feeding',
    });
  } else if (tideBoost < 0) {
    factors.push({
      name: 'Slack tide',
      impact: '-',
      detail: 'Water movement slows near high/low tide',
    });
  }

  let activityRating = normalizeActivityRating(
    computeBiteRawScore(options),
    period,
    isPrime
  );

  const tip = PERIOD_TIPS[period] ?? PERIOD_TIPS.Morning;
  const recommendedLures = forecast.tackleRecommendations
    .slice(0, 3)
    .map((t) => t.name);
  const communityLures = getCommunityTopLures(options.communityCatchActivity ?? [], 3);

  const nextWindow = computeNextWindow(now, weather);
  const hourlyForecast = buildHourlyBiteForecast(lat, lon, sourceWeather, now, {
    tides: options.tides,
    spotCatchTimes: options.spotCatchTimes,
    personalCatchTimes: options.personalCatchTimes,
    spotSpecies: options.spotSpecies,
    focusDate,
  });
  const dailyCurve = buildDailyBiteCurve(lat, lon, sourceWeather, now, {
    tides: options.tides,
    spotCatchTimes: options.spotCatchTimes,
    personalCatchTimes: options.personalCatchTimes,
    spotSpecies: options.spotSpecies,
  });
  const speciesBestTimes = getSpeciesBestWindows({
    latitude: lat,
    longitude: lon,
    weather,
    date: now,
    spotSpecies: options.spotSpecies,
  });

  return {
    activityRating,
    label: getActivityLabel(activityRating),
    period,
    summary: `${getActivityLabel(activityRating)} · ${period}`,
    tip,
    factors,
    nextWindow,
    recommendedLures,
    communityLures: communityLures.length > 0 ? communityLures : undefined,
    solarTimeline: buildSolarTimeline(now, weather),
    communityCatchTimes: options.spotCatchTimes?.slice(0, 3),
    personalCatchTimes: options.personalCatchTimes?.slice(0, 3),
    tideNote: buildTideNote(options.tides, now),
    hourlyForecast,
    forecastSubtitle: buildForecastSubtitle(weather, nextWindow),
    dailyCurve,
    speciesBestTimes,
  };
}

/** @deprecated Use getBestTimeNow instead */
export function getTimeOfDayRecommendation(): { period: string; tip: string } {
  const result = getBestTimeNow({ latitude: null, longitude: null });
  return { period: result.period, tip: result.tip };
}
