import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';

export interface WeatherSnapshot {
  temperatureF: number;
  windSpeedMph: number;
  windDirection: number;
  precipitationInch: number;
  pressureMb: number;
  cloudCoverPercent: number;
  isDay: boolean;
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
}

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
      console.warn('BFF weather unavailable, falling back to Open-Meteo:', error);
    }
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,cloud_cover,is_day` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }

  const data: OpenMeteoResponse = await response.json();
  return {
    temperatureF: data.current.temperature_2m,
    windSpeedMph: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    precipitationInch: data.current.precipitation,
    pressureMb: data.current.surface_pressure,
    cloudCoverPercent: data.current.cloud_cover,
    isDay: data.current.is_day === 1,
  };
}
