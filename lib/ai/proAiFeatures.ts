import { hostedGenerateText } from '@/lib/ai/hostedAiClient';
import { isAiFishTodayEnabled, isAiTripBriefEnabled } from '@/constants/features';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';

export async function generateAiFishTodayRanking(
  spots: RankedDiscoverySpot[],
  weather?: WeatherSnapshot | null
): Promise<{ text: string | null; error: string | null }> {
  if (!isAiFishTodayEnabled()) {
    return { text: null, error: 'CatchMap Pro is required.' };
  }

  const top = spots.slice(0, 5);
  if (top.length === 0) {
    return { text: null, error: 'No scored spots in view yet.' };
  }

  const spotLines = top
    .map(
      (s, i) =>
        `${i + 1}. ${s.spot.name} — bite ${s.score.activityRating}/5 (${s.score.label}), ${s.spot.distance?.toFixed(1) ?? '?'} mi`
    )
    .join('\n');

  const { text, error } = await hostedGenerateText({
    feature: 'fish_today',
    systemPrompt:
      'You are CatchMap Pro. Pick the top 3 fishing spots for today from the list. Be concise and practical.',
    userPrompt: `Weather: ${weather ? `${weather.temperatureF}°F, wind ${weather.windSpeedMph} mph` : 'unknown'}
Scored spots:
${spotLines}

Reply with exactly 3 spots as numbered bullets. For each: spot name, why now, and one rig tip. Under 120 words total.`,
    temperature: 0.6,
    maxOutputTokens: 400,
  });

  return { text, error: error?.message ?? null };
}

export async function generateAiTripBrief(input: {
  spot: NearbySpot;
  weather?: WeatherSnapshot | null;
  coachAdvice?: CatchCoachAdvice | null;
  regulationNotices?: string[];
}): Promise<{ text: string | null; error: string | null }> {
  if (!isAiTripBriefEnabled()) {
    return { text: null, error: 'CatchMap Pro is required.' };
  }

  const { spot, weather, coachAdvice, regulationNotices } = input;
  const { text, error } = await hostedGenerateText({
    feature: 'trip_brief',
    systemPrompt:
      'You are CatchMap Pro trip planner. Write a short pre-trip brief for an angler.',
    userPrompt: `Spot: ${spot.name} (${spot.water_type})
Weather: ${weather ? `${weather.temperatureF}°F, wind ${weather.windSpeedMph} mph` : 'check locally'}
Coach: ${coachAdvice?.headline ?? 'n/a'}
Regulations: ${regulationNotices?.slice(0, 3).join('; ') || 'check local rules'}

Write 3 short paragraphs: (1) go/no-go and best window, (2) rig and technique, (3) reminders. Under 150 words.`,
    temperature: 0.55,
    maxOutputTokens: 512,
  });

  return { text, error: error?.message ?? null };
}
