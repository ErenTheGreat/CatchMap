import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import { computeCivilTwilight, computeMoonData } from '@/utils/solarTimes';

export type PressureTrend = 'falling' | 'rising' | 'stable';

export interface HourlyWeatherPoint {
  time: string;
  temperatureF: number;
  windSpeedMph: number;
  precipitationInch: number;
  pressureMb: number;
  cloudCoverPercent: number;
}

export interface HourlyBiteForecast {
  time: string;
  hourLabel: string;
  activityRating: 1 | 2 | 3 | 4 | 5;
  activityLabel?: string;
  period?: string;
  isNow?: boolean;
  highlights?: string[];
}

export interface DailySunTimes {
  /** Local calendar date YYYY-MM-DD from the forecast provider. */
  date: string;
  sunrise: string;
  sunset: string;
}

export interface WeatherSnapshot {
  temperatureF: number;
  windSpeedMph: number;
  windDirection: number;
  precipitationInch: number;
  pressureMb: number;
  cloudCoverPercent: number;
  isDay: boolean;
  sunrise?: string;
  sunset?: string;
  civilTwilightBegin?: string;
  civilTwilightEnd?: string;
  pressureTrend?: PressureTrend;
  hourly?: HourlyWeatherPoint[];
  /** Full fetched hourly range (incl. past hours of today) for day-long charts. */
  hourlyToday?: HourlyWeatherPoint[];
  /** Up to 7 days of sunrise/sunset for trip planning on future dates. */
  dailySunTimes?: DailySunTimes[];
  moonPhase?: number;
  moonrise?: string;
  moonset?: string;
  moonPhaseLabel?: string;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    precipitation: number;
    surface_pressure: number;
    cloud_cover: number;
    is_day: number;
  };
  daily?: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    precipitation: number[];
    surface_pressure: number[];
    cloud_cover: number[];
  };
}

function computePressureTrend(hourly?: HourlyWeatherPoint[]): PressureTrend | undefined {
  if (!hourly || hourly.length < 4) return undefined;
  const current = hourly[0].pressureMb;
  const threeHoursAgo = hourly[Math.min(3, hourly.length - 1)].pressureMb;
  const diff = current - threeHoursAgo;
  if (diff <= -2) return 'falling';
  if (diff >= 2) return 'rising';
  return 'stable';
}

function parseHourlyWeather(data: OpenMeteoResponse): HourlyWeatherPoint[] {
  const hourly: HourlyWeatherPoint[] = [];
  if (!data.hourly?.time) return hourly;

  const count = Math.min(72, data.hourly.time.length);
  for (let i = 0; i < count; i++) {
    hourly.push({
      time: data.hourly.time[i],
      temperatureF: data.hourly.temperature_2m[i],
      windSpeedMph: data.hourly.wind_speed_10m[i],
      precipitationInch: data.hourly.precipitation[i],
      pressureMb: data.hourly.surface_pressure[i],
      cloudCoverPercent: data.hourly.cloud_cover[i],
    });
  }
  return hourly;
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectNext12Hours(
  hourly: HourlyWeatherPoint[],
  now: Date = new Date()
): HourlyWeatherPoint[] {
  const nowMs = now.getTime();
  return hourly
    .filter((point) => new Date(point.time).getTime() >= nowMs - 30 * 60 * 1000)
    .slice(0, 12);
}

/** Hourly forecast slots for a local calendar day (used by trip planner). */
export function selectHourlyForLocalDate(
  hourly: HourlyWeatherPoint[],
  date: Date,
  fromHour = 5,
  toHour = 14
): HourlyWeatherPoint[] {
  const dayKey = getLocalDateKey(date);
  return hourly.filter((point) => {
    const pointDate = new Date(point.time);
    if (getLocalDateKey(pointDate) !== dayKey) return false;
    const hour = pointDate.getHours();
    return hour >= fromHour && hour < toHour;
  });
}

export function hasHourlyForecastForDate(
  hourly: HourlyWeatherPoint[] | undefined,
  date: Date
): boolean {
  if (!hourly?.length) return false;
  return selectHourlyForLocalDate(hourly, date, 0, 24).length > 0;
}

export function getDailySunTimes(
  weather: Pick<WeatherSnapshot, 'dailySunTimes' | 'sunrise' | 'sunset'> | null | undefined,
  date: Date
): DailySunTimes | undefined {
  const dayKey = getLocalDateKey(date);
  const match = weather?.dailySunTimes?.find((entry) => entry.date === dayKey);
  if (match) return match;
  if (weather?.sunrise && weather?.sunset && getLocalDateKey(new Date()) === dayKey) {
    return { date: dayKey, sunrise: weather.sunrise, sunset: weather.sunset };
  }
  return undefined;
}

function parseDailySunTimes(data: OpenMeteoResponse): DailySunTimes[] {
  const times = data.daily?.time;
  const sunrises = data.daily?.sunrise;
  const sunsets = data.daily?.sunset;
  if (!times?.length || !sunrises?.length || !sunsets?.length) return [];

  const count = Math.min(times.length, sunrises.length, sunsets.length);
  const entries: DailySunTimes[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      date: times[i],
      sunrise: sunrises[i],
      sunset: sunsets[i],
    });
  }
  return entries;
}

function parseOpenMeteoResponse(
  data: OpenMeteoResponse,
  latitude: number,
  longitude: number
): WeatherSnapshot {
  const allHourly = parseHourlyWeather(data);
  const hourly = selectNext12Hours(allHourly);
  // Trend math expects the array to start at the current hour; allHourly now
  // includes past hours, so use the from-now selection.
  const pressureTrend = computePressureTrend(hourly);

  const dailySunTimes = parseDailySunTimes(data);
  const sunrise = dailySunTimes[0]?.sunrise ?? data.daily?.sunrise?.[0];
  const sunset = dailySunTimes[0]?.sunset ?? data.daily?.sunset?.[0];

  let civilTwilightBegin: string | undefined;
  let civilTwilightEnd: string | undefined;
  if (sunrise && sunset) {
    const twilight = computeCivilTwilight(new Date(sunrise), latitude, longitude);
    civilTwilightBegin = twilight.begin.toISOString();
    civilTwilightEnd = twilight.end.toISOString();
  }

  const moon = computeMoonData(
    sunrise ? new Date(sunrise) : new Date(),
    latitude,
    longitude
  );

  return {
    temperatureF: data.current.temperature_2m,
    windSpeedMph: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    precipitationInch: data.current.precipitation,
    pressureMb: data.current.surface_pressure,
    cloudCoverPercent: data.current.cloud_cover,
    isDay: data.current.is_day === 1,
    sunrise,
    sunset,
    civilTwilightBegin,
    civilTwilightEnd,
    pressureTrend,
    hourly,
    hourlyToday: allHourly.length > 0 ? allHourly : undefined,
    dailySunTimes: dailySunTimes.length > 0 ? dailySunTimes : undefined,
    moonPhase: moon.moonPhase,
    moonrise: moon.moonrise,
    moonset: moon.moonset,
    moonPhaseLabel: moon.moonPhaseLabel,
  };
}

const OPEN_METEO_PARAMS =
  'current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,cloud_cover,is_day' +
  '&daily=sunrise,sunset' +
  '&hourly=temperature_2m,wind_speed_10m,precipitation,surface_pressure,cloud_cover' +
  '&past_hours=24' +
  '&forecast_hours=72' +
  '&forecast_days=7' +
  '&timezone=auto' +
  '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch';

/** BFF first; falls back to calling Open-Meteo directly (free, keyless). */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<WeatherSnapshot> {
  if (isBffEnabled()) {
    try {
      return await bffRequest<WeatherSnapshot>('/api/weather', {
        params: { lat: latitude, lon: longitude },
        signal,
      });
    } catch (error) {
      if (__DEV__) console.warn('BFF weather unavailable, falling back to Open-Meteo:', error);
    }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&${OPEN_METEO_PARAMS}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  return parseOpenMeteoResponse(data, latitude, longitude);
}
