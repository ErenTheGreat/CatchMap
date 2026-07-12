import { hostedGenerateText } from '@/lib/ai/hostedAiClient';
import { isAiFishTodayEnabled, isAiTripBriefEnabled, isOnWaterCopilotEnabled } from '@/constants/features';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';
import type { TodaySpeciesTarget } from '@/utils/rankTodaySpeciesTargets';

export async function generateAiFishTodayRanking(
  spots: RankedDiscoverySpot[],
  weather?: WeatherSnapshot | null,
  speciesTargets?: TodaySpeciesTarget[]
): Promise<{ text: string | null; error: string | null }> {
  if (!isAiFishTodayEnabled()) {
    return { text: null, error: 'CatchMap Pro is required.' };
  }

  const top = spots.slice(0, 5);
  if (top.length === 0 && (speciesTargets?.length ?? 0) === 0) {
    return { text: null, error: 'No scored spots in view yet.' };
  }

  const spotLines = top
    .map((s, i) => {
      const speciesHint = s.score.topSpeciesHint
        ? `, likely ${s.score.topSpeciesHint}`
        : '';
      return `${i + 1}. ${s.spot.name} — bite ${s.score.activityRating}/5 (${s.score.label}), ${s.spot.distance?.toFixed(1) ?? '?'} mi${speciesHint}`;
    })
    .join('\n');

  const speciesLines =
    speciesTargets
      ?.slice(0, 3)
      .map((target, i) => {
        const rig = target.rigLabel ? `, rig: ${target.rigLabel}` : '';
        const window = target.goNowLabel ? `, ${target.goNowLabel}` : '';
        return `${i + 1}. ${target.speciesName} @ ${target.bestSpot.name} — ${target.matchScore}% match${rig}${window}`;
      })
      .join('\n') ?? '';

  const { text, error } = await hostedGenerateText({
    feature: 'fish_today',
    systemPrompt:
      'You are CatchMap Pro. Summarize the best fishing plan for today. Be concise and practical.',
    userPrompt: `Weather: ${weather ? `${weather.temperatureF}°F, wind ${weather.windSpeedMph} mph` : 'unknown'}
${speciesLines ? `Engine-ranked species targets:\n${speciesLines}\n` : ''}${spotLines ? `Scored spots:\n${spotLines}\n` : ''}
Write a short daily briefing: what to target, where to go, best time windows, and one rig tip per pick. Under 120 words.`,
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

export async function generateOnWaterCopilotResponse(input: {
  question: string;
  spotName?: string | null;
  waterType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  weather?: WeatherSnapshot | null;
  speciesName?: string | null;
  biteLabel?: string | null;
  personalNote?: string | null;
}): Promise<{ text: string | null; error: string | null }> {
  if (!isOnWaterCopilotEnabled()) {
    return { text: null, error: 'CatchMap Pro is required.' };
  }

  const { text, error } = await hostedGenerateText({
    feature: 'on_water_copilot',
    systemPrompt:
      'You are On-Water Copilot inside CatchMap Pro. The angler is at the water right now. Give short, hands-free-friendly advice in 2-4 sentences. Be decisive.',
    userPrompt: `GPS pin: ${input.spotName ?? 'open water'} (${input.waterType ?? 'unknown'})
Coords: ${input.latitude ?? '?'}, ${input.longitude ?? '?'}
Weather: ${input.weather ? `${input.weather.temperatureF}°F, wind ${input.weather.windSpeedMph} mph, pressure ${input.weather.pressureTrend ?? 'unknown'}` : 'unknown'}
Bite now: ${input.biteLabel ?? 'unknown'}
Target species: ${input.speciesName ?? 'unknown'}
Personal note: ${input.personalNote ?? 'none'}

Question: ${input.question}`,
    temperature: 0.55,
    maxOutputTokens: 280,
  });

  return { text, error: error?.message ?? null };
}
