import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import type { NearbySpot } from '@/utils/osmFishingSpots';

vi.mock('@/lib/ai/hostedAiClient', () => ({
  hostedGenerateText: vi.fn(),
}));

vi.mock('@/constants/features', () => ({
  isAiFishTodayEnabled: vi.fn(() => true),
  isAiTripBriefEnabled: vi.fn(() => true),
}));

import { hostedGenerateText } from '@/lib/ai/hostedAiClient';
import { isAiFishTodayEnabled } from '@/constants/features';
import { generateAiFishTodayRanking } from '@/lib/ai/proAiFeatures';

function makeRanked(
  id: string,
  name: string,
  rating: number,
  label: string,
  distance: number,
  topSpeciesHint?: string
): RankedDiscoverySpot {
  const spot: NearbySpot = {
    id,
    name,
    description: null,
    latitude: 40,
    longitude: -74,
    water_type: 'lake',
    species: [],
    facilities: [],
    best_months: [6, 7],
    rating: 4,
    created_at: '2026-01-01T00:00:00.000Z',
    distance,
    matchedSpecies: [],
    isPeakSeason: false,
  };
  return {
    spot,
    rank: 1,
    score: {
      spotId: id,
      activityRating: rating as 1 | 2 | 3 | 4 | 5,
      label,
      period: 'Morning',
      summary: `${label} · Morning`,
      tip: 'Try shallow cover',
      factors: [],
      hourlyForecast: [],
      topSpeciesHint,
    },
  };
}

describe('generateAiFishTodayRanking', () => {
  beforeEach(() => {
    vi.mocked(isAiFishTodayEnabled).mockReturnValue(true);
    vi.mocked(hostedGenerateText).mockReset();
    vi.mocked(hostedGenerateText).mockResolvedValue({
      text: '1. Lake A — good wind\n2. Bay B — tide\n3. River C — shade',
      error: null,
    });
  });

  it('requires Pro', async () => {
    vi.mocked(isAiFishTodayEnabled).mockReturnValue(false);
    const result = await generateAiFishTodayRanking([], null);
    expect(result).toEqual({ text: null, error: 'CatchMap Pro is required.' });
    expect(hostedGenerateText).not.toHaveBeenCalled();
  });

  it('rejects empty spot list', async () => {
    const result = await generateAiFishTodayRanking([], { temperatureF: 70, windSpeedMph: 5 } as never);
    expect(result.error).toBe('No scored spots in view yet.');
  });

  it('sends only spot names, bite scores, distance — not species hints', async () => {
    const spots = [
      makeRanked('a', 'Lake Alpha', 5, 'Hot', 1.2, 'Largemouth Bass'),
      makeRanked('b', 'Bay Beta', 4, 'Good', 3.4, 'Striped Bass'),
    ];

    await generateAiFishTodayRanking(spots, { temperatureF: 72, windSpeedMph: 8 } as never);

    const call = vi.mocked(hostedGenerateText).mock.calls[0]?.[0];
    expect(call?.feature).toBe('fish_today');
    expect(call?.userPrompt).toContain('Lake Alpha');
    expect(call?.userPrompt).toContain('bite 5/5');
    expect(call?.userPrompt).toContain('1.2 mi');
    expect(call?.userPrompt).toContain('Largemouth Bass');
    expect(call?.userPrompt).toContain('daily briefing');
  });

  it('caps input at five spots even when more are passed', async () => {
    const spots = Array.from({ length: 7 }, (_, i) =>
      makeRanked(`s${i}`, `Spot ${i}`, 3, 'Fair', i + 1)
    );

    await generateAiFishTodayRanking(spots, null);

    const prompt = vi.mocked(hostedGenerateText).mock.calls[0]?.[0]?.userPrompt ?? '';
    const numberedLines = prompt.split('\n').filter((line) => /^\d+\./.test(line));
    expect(numberedLines).toHaveLength(5);
  });
});
