import { hostedGenerateVision } from '@/lib/ai/hostedAiClient';
import { isWaterWhisperEnabled } from '@/constants/features';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/recommendations';

export interface WaterWhisperInput {
  imageBase64: string;
  mimeType?: string;
  spot?: NearbySpot | null;
  weather?: WeatherSnapshot | null;
  topSpecies?: string | null;
}

export async function analyzeWaterScene(
  input: WaterWhisperInput
): Promise<{ text: string | null; error: string | null }> {
  if (!isWaterWhisperEnabled()) {
    return { text: null, error: 'CatchMap Pro is required.' };
  }

  const spotLine = input.spot
    ? `Spot: ${input.spot.name} (${input.spot.water_type})`
    : 'Spot: unknown water body';
  const weatherLine = input.weather
    ? `Weather: ${input.weather.temperatureF}°F, wind ${input.weather.windSpeedMph} mph, clouds ${input.weather.cloudCoverPercent}%`
    : 'Weather: unknown';
  const speciesLine = input.topSpecies ? `Likely species: ${input.topSpecies}` : '';

  const prompt = `You are Water Whisper — a tactical fishing coach reading the water from a photo.

${spotLine}
${weatherLine}
${speciesLine}

Analyze clarity, cover, sky, and water color. Return:
1) What you see (1 sentence)
2) Best approach — depth, cover, speed (2 bullets)
3) Top 2 lure/bait picks for these conditions

Keep under 100 words. Be specific and practical.`;

  const { text, error } = await hostedGenerateVision({
    feature: 'water_whisper',
    prompt,
    imageBase64: input.imageBase64,
    mimeType: input.mimeType ?? 'image/jpeg',
    temperature: 0.5,
    maxOutputTokens: 350,
  });

  return { text, error: error?.message ?? null };
}
