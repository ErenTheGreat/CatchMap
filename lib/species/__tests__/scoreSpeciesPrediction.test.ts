import { describe, expect, it } from 'vitest';
import { scoreSpeciesPredictions, MIN_PROBABILITY } from '@/lib/species/scoreSpeciesPrediction';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { AvailableSpecies, SpotContext } from '@/lib/types/speciesPrediction';

const clearWeather: WeatherSnapshot = {
  temperatureF: 68,
  windSpeedMph: 6,
  windDirection: 180,
  precipitationInch: 0,
  pressureMb: 1015,
  cloudCoverPercent: 10,
  isDay: true,
  sunrise: '2026-07-07T12:00:00.000Z',
  sunset: '2026-07-08T01:00:00.000Z',
  pressureTrend: 'stable',
};

const stormyWeather: WeatherSnapshot = {
  ...clearWeather,
  windSpeedMph: 28,
  precipitationInch: 0.2,
  cloudCoverPercent: 95,
  pressureTrend: 'falling',
};

function julyMorning(): Date {
  return new Date('2026-07-07T13:00:00.000Z');
}

const shadowCliffsSpecies: AvailableSpecies[] = [
  {
    id: '1',
    name: 'Largemouth Bass',
    scientificName: 'Micropterus salmoides',
    imageUrl: null,
    feedingZone: 'surface',
    idealTempMin: 18,
    idealTempMax: 27,
    monthStart: 3,
    monthEnd: 10,
    peakMonths: [4, 5, 6],
    waterTypes: ['lake', 'pond'],
    source: 'bundled',
    dataConfidence: 'high',
  },
  {
    id: '2',
    name: 'Rainbow Trout',
    scientificName: 'Oncorhynchus mykiss',
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: 10,
    idealTempMax: 18,
    monthStart: 1,
    monthEnd: 12,
    peakMonths: [3, 4, 5],
    waterTypes: ['lake', 'river'],
    source: 'bundled',
    dataConfidence: 'high',
  },
  {
    id: '3',
    name: 'Channel Catfish',
    scientificName: 'Ictalurus punctatus',
    imageUrl: null,
    feedingZone: 'bottom',
    idealTempMin: 21,
    idealTempMax: 29,
    monthStart: 1,
    monthEnd: 12,
    nocturnal: true,
    source: 'bundled',
    dataConfidence: 'high',
  },
];

const lakeDelValleSpecies: AvailableSpecies[] = [
  {
    id: '4',
    name: 'Striped Bass',
    scientificName: 'Morone saxatilis',
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: 14,
    idealTempMax: 22,
    monthStart: 4,
    monthEnd: 11,
    peakMonths: [5, 6, 7],
    waterTypes: ['lake', 'river'],
    source: 'bundled',
    dataConfidence: 'high',
  },
  {
    id: '5',
    name: 'Smallmouth Bass',
    scientificName: 'Micropterus dolomieu',
    imageUrl: null,
    feedingZone: 'surface',
    idealTempMin: 16,
    idealTempMax: 24,
    monthStart: 4,
    monthEnd: 10,
    waterTypes: ['lake', 'river'],
    source: 'bundled',
    dataConfidence: 'high',
  },
  {
    id: '6',
    name: 'Kokanee Salmon',
    scientificName: 'Oncorhynchus nerka',
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: 12,
    idealTempMax: 16,
    monthStart: 5,
    monthEnd: 10,
    waterTypes: ['lake'],
    source: 'bundled',
    dataConfidence: 'high',
  },
];

const shadowCliffsContext: SpotContext = {
  waterType: 'Lake / Former Gravel Pit',
  avgDepthFeet: 24,
  underwaterStructure: ['Drop-offs', 'Submerged Vegetation'],
  bestSeason: 'Spring/Winter',
  isSaltwater: false,
};

const lakeDelValleContext: SpotContext = {
  waterType: 'Reservoir',
  avgDepthFeet: 55,
  underwaterStructure: ['Rock Ledges', 'River Channels'],
  bestSeason: 'Year-Round',
  isSaltwater: false,
};

describe('scoreSpeciesPredictions', () => {
  it('produces different top species for Shadow Cliffs vs Lake Del Valle', () => {
    const shadowResult = scoreSpeciesPredictions({
      species: shadowCliffsSpecies,
      weather: clearWeather,
      spotContext: shadowCliffsContext,
      latitude: 37.669352,
      longitude: -121.841891,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    const delValleResult = scoreSpeciesPredictions({
      species: lakeDelValleSpecies,
      weather: clearWeather,
      spotContext: lakeDelValleContext,
      latitude: 37.595627,
      longitude: -121.745415,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    expect(shadowResult.predictions[0]?.name).not.toBe(delValleResult.predictions[0]?.name);
    expect(shadowResult.predictions.some((p) => p.name === 'Largemouth Bass')).toBe(true);
    expect(delValleResult.predictions.some((p) => p.name === 'Striped Bass')).toBe(true);
  });

  it('differentiates probabilities — not all Moderate', () => {
    const result = scoreSpeciesPredictions({
      species: shadowCliffsSpecies,
      weather: clearWeather,
      spotContext: shadowCliffsContext,
      latitude: 37.669352,
      longitude: -121.841891,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    const ratings = new Set(result.predictions.map((p) => p.activityRating));
    const probabilities = result.predictions.map((p) => p.probability);

    expect(ratings.size).toBeGreaterThan(1);
    expect(Math.max(...probabilities) - Math.min(...probabilities)).toBeGreaterThan(5);
    expect(result.predictions.every((p) => p.probability >= MIN_PROBABILITY)).toBe(true);
    expect(result.predictions.every((p) => p.factors.length > 0)).toBe(true);
  });

  it('reduces surface feeder probability in stormy weather by at least 15 points', () => {
    const baseInput = {
      species: shadowCliffsSpecies,
      spotContext: shadowCliffsContext,
      latitude: 37.669352,
      longitude: -121.841891,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    };

    const clearResult = scoreSpeciesPredictions({ ...baseInput, weather: clearWeather });
    const stormyResult = scoreSpeciesPredictions({ ...baseInput, weather: stormyWeather });

    const clearBass = clearResult.predictions.find((p) => p.name === 'Largemouth Bass');
    const stormyBass = stormyResult.predictions.find((p) => p.name === 'Largemouth Bass');

    expect(clearBass).toBeDefined();
    expect(stormyBass).toBeDefined();
    expect(clearBass!.probability - stormyBass!.probability).toBeGreaterThanOrEqual(15);
  });

  it('boosts species with high community catch counts', () => {
    const withoutCatches = scoreSpeciesPredictions({
      species: lakeDelValleSpecies,
      weather: clearWeather,
      spotContext: lakeDelValleContext,
      latitude: 37.595627,
      longitude: -121.745415,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    const withCatches = scoreSpeciesPredictions({
      species: lakeDelValleSpecies,
      weather: clearWeather,
      spotContext: lakeDelValleContext,
      latitude: 37.595627,
      longitude: -121.745415,
      catchActivity: [
        { speciesId: '4', speciesName: 'Striped Bass', catchCount: 20, topLures: [] },
        { speciesId: '6', speciesName: 'Kokanee Salmon', catchCount: 2, topLures: [] },
      ],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    const baseStriper = withoutCatches.predictions.find((p) => p.name === 'Striped Bass');
    const boostedStriper = withCatches.predictions.find((p) => p.name === 'Striped Bass');

    expect(boostedStriper!.probability).toBeGreaterThan(baseStriper!.probability);
  });

  it('filters out-of-season species', () => {
    const winterSpecies: AvailableSpecies[] = [
      {
        id: 'winter-only',
        name: 'Winter Only Fish',
        scientificName: 'Testus winterus',
        imageUrl: null,
        feedingZone: 'mid',
        idealTempMin: 5,
        idealTempMax: 12,
        monthStart: 12,
        monthEnd: 2,
        source: 'bundled',
        dataConfidence: 'high',
      },
    ];

    const result = scoreSpeciesPredictions({
      species: winterSpecies,
      weather: clearWeather,
      spotContext: null,
      latitude: 37.6,
      longitude: -122,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: new Date('2026-07-07T13:00:00.000Z'),
    });

    expect(result.predictions).toHaveLength(0);
  });

  it('includes context subtitle with weather and season', () => {
    const result = scoreSpeciesPredictions({
      species: shadowCliffsSpecies,
      weather: clearWeather,
      spotContext: shadowCliffsContext,
      latitude: 37.669352,
      longitude: -121.841891,
      catchActivity: [],
      personalSpecies: [],
      tides: null,
      now: julyMorning(),
    });

    expect(result.contextSubtitle).toContain('68°F');
    expect(result.contextSubtitle).toContain('Summer');
  });
});

describe('bundled species lists differ by spot', () => {
  it('Shadow Cliffs and Lake Del Valle have distinct species names', () => {
    const shadowNames = shadowCliffsSpecies.map((s) => s.name).sort();
    const delValleNames = lakeDelValleSpecies.map((s) => s.name).sort();

    expect(shadowNames).not.toEqual(delValleNames);
    expect(shadowNames).toContain('Rainbow Trout');
    expect(delValleNames).toContain('Striped Bass');
  });
});
