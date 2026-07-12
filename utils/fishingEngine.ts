export type Hemisphere = 'Northern' | 'Southern';
export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';
export type TimeOfDay = 'Morning' | 'Midday' | 'Evening' | 'Night';
export type Biome =
  | 'Freshwater Lake'
  | 'Freshwater River'
  | 'Coastal Saltwater'
  | 'Tropical Estuary';

export type ActivityRating = 1 | 2 | 3 | 4 | 5;

export interface WaterConditions {
  clarity: string;
  temperatureBand: string;
  oxygenLevel: string;
  activityLevel: string;
  summary: string;
}

export interface ActiveSpecies {
  id: string;
  name: string;
  activityRating: ActivityRating;
  peakNow: boolean;
  note: string;
  activeTimes: TimeOfDay[];
}

export interface TackleRecommendation {
  name: string;
  type: 'lure' | 'bait';
  reason: string;
}

export interface FishingForecast {
  summary: string;
  hemisphere: Hemisphere;
  season: Season;
  timeOfDay: TimeOfDay;
  biome: Biome;
  waterConditions: WaterConditions;
  activeSpecies: ActiveSpecies[];
  tackleRecommendations: TackleRecommendation[];
  generatedAt: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getHemisphere(latitude: number): Hemisphere {
  return latitude >= 0 ? 'Northern' : 'Southern';
}

function getSeason(month: number, hemisphere: Hemisphere): Season {
  const adjustedMonth = hemisphere === 'Southern' ? ((month + 5) % 12) + 1 : month;

  if (adjustedMonth >= 3 && adjustedMonth <= 5) return 'Spring';
  if (adjustedMonth >= 6 && adjustedMonth <= 8) return 'Summer';
  if (adjustedMonth >= 9 && adjustedMonth <= 11) return 'Fall';
  return 'Winter';
}

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 11) return 'Morning';
  if (hour >= 11 && hour < 14) return 'Midday';
  if (hour >= 14 && hour < 20) return 'Evening';
  return 'Night';
}

function isNearCoast(latitude: number, longitude: number): boolean {
  const coastalZones = [
    { minLat: 24, maxLat: 31, minLon: -98, maxLon: -80 },
    { minLat: 32, maxLat: 45, minLon: -125, maxLon: -117 },
    { minLat: 40, maxLat: 45, minLon: -75, maxLon: -66 },
    { minLat: 18, maxLat: 28, minLon: -88, maxLon: -65 },
    { minLat: -45, maxLat: -10, minLon: 110, maxLon: 155 },
    { minLat: 50, maxLat: 60, minLon: -10, maxLon: 3 },
    { minLat: 35, maxLat: 46, minLon: 129, maxLon: 142 },
  ];

  return coastalZones.some(
    (zone) =>
      latitude >= zone.minLat &&
      latitude <= zone.maxLat &&
      longitude >= zone.minLon &&
      longitude <= zone.maxLon
  );
}

function estimateBiome(latitude: number, longitude: number): Biome {
  if (latitude >= 18 && latitude <= 28 && longitude >= -88 && longitude <= -65) {
    return 'Tropical Estuary';
  }

  if (isNearCoast(latitude, longitude)) {
    const inlandBuffer =
      Math.abs(longitude % 5) < 1.5 || Math.abs(latitude % 4) < 1;
    if (!inlandBuffer || latitude < 35) {
      return 'Coastal Saltwater';
    }
  }

  if (latitude > 48 || (latitude > 40 && Math.abs(longitude) > 100)) {
    return 'Freshwater River';
  }

  return 'Freshwater Lake';
}

function getWaterConditions(
  season: Season,
  timeOfDay: TimeOfDay,
  biome: Biome,
  hemisphere: Hemisphere
): WaterConditions {
  const tempBySeason: Record<Season, string> = {
    Spring: hemisphere === 'Northern' ? '55–65°F / 13–18°C' : '55–65°F / 13–18°C',
    Summer: hemisphere === 'Northern' ? '70–82°F / 21–28°C' : '70–82°F / 21–28°C',
    Fall: '58–68°F / 14–20°C',
    Winter: '38–48°F / 3–9°C',
  };

  const clarityByBiome: Record<Biome, string> = {
    'Freshwater Lake': 'Moderate — algae bloom possible in summer',
    'Freshwater River': 'Variable — clearer upstream, stained after rain',
    'Coastal Saltwater': 'Tidal influenced — check incoming tide',
    'Tropical Estuary': 'Brackish — murky near mangroves, clearer on flats',
  };

  const activityByTime: Record<TimeOfDay, string> = {
    Morning: 'High — fish feeding aggressively in shallow water',
    Midday: 'Moderate — seek deeper structure or shade',
    Evening: 'High — second feeding window of the day',
    Night: 'Selective — nocturnal species dominate',
  };

  const oxygenBySeason: Record<Season, string> = {
    Spring: 'Rising — post-thaw turnover stabilizing',
    Summer: 'Lower in shallow water — target deeper zones midday',
    Fall: 'Peak — cooling water holds more dissolved oxygen',
    Winter: 'Stable in deep pools — metabolism slowed',
  };

  return {
    clarity: clarityByBiome[biome],
    temperatureBand: tempBySeason[season],
    oxygenLevel: oxygenBySeason[season],
    activityLevel: activityByTime[timeOfDay],
    summary: `${season} ${timeOfDay.toLowerCase()} conditions in ${biome.toLowerCase()} habitat.`,
  };
}

interface SpeciesProfile {
  id: string;
  name: string;
  biomes: Biome[];
  peakSeasons: Season[];
  activeTimes: TimeOfDay[];
  baseRating: ActivityRating;
  note: string;
}

const GLOBAL_SPECIES: SpeciesProfile[] = [
  {
    id: 'largemouth-bass',
    name: 'Largemouth Bass',
    biomes: ['Freshwater Lake', 'Freshwater River', 'Tropical Estuary'],
    peakSeasons: ['Spring', 'Fall'],
    activeTimes: ['Morning', 'Evening'],
    baseRating: 3,
    note: 'Targets shallow cover and structure near weed lines.',
  },
  {
    id: 'trout',
    name: 'Trout',
    biomes: ['Freshwater Lake', 'Freshwater River'],
    peakSeasons: ['Spring', 'Fall'],
    activeTimes: ['Morning', 'Midday'],
    baseRating: 3,
    note: 'Prefers cool, oxygen-rich water — insect hatches drive feeding.',
  },
  {
    id: 'pike',
    name: 'Pike',
    biomes: ['Freshwater Lake', 'Freshwater River'],
    peakSeasons: ['Spring', 'Fall'],
    activeTimes: ['Morning', 'Evening'],
    baseRating: 3,
    note: 'Ambush predator — lurks in weed beds and shallow bays.',
  },
  {
    id: 'snook',
    name: 'Saltwater Snook',
    biomes: ['Coastal Saltwater', 'Tropical Estuary'],
    peakSeasons: ['Summer', 'Fall'],
    activeTimes: ['Evening', 'Night'],
    baseRating: 3,
    note: 'Structure-oriented — docks, mangroves, and inlet mouths.',
  },
  {
    id: 'walleye',
    name: 'Walleye',
    biomes: ['Freshwater Lake', 'Freshwater River'],
    peakSeasons: ['Spring', 'Fall'],
    activeTimes: ['Evening', 'Night'],
    baseRating: 3,
    note: 'Low-light feeder — gravel bars and drop-offs at dusk.',
  },
];

function scoreSpecies(
  profile: SpeciesProfile,
  season: Season,
  timeOfDay: TimeOfDay,
  biome: Biome
): { rating: ActivityRating; peakNow: boolean; note: string } {
  let score = profile.baseRating;

  const biomeMatch = profile.biomes.includes(biome);
  if (!biomeMatch) score -= 2;
  else score += 1;

  const seasonMatch = profile.peakSeasons.includes(season);
  if (seasonMatch) score += 1;

  const timeMatch = profile.activeTimes.includes(timeOfDay);
  if (timeMatch) score += 1;

  if (timeOfDay === 'Midday' && profile.activeTimes.includes('Morning')) {
    score -= 1;
  }

  const rating = Math.max(1, Math.min(5, score)) as ActivityRating;
  const peakNow = biomeMatch && seasonMatch && timeMatch;

  let note = profile.note;
  if (!biomeMatch) {
    note = `Uncommon in ${biome.toLowerCase()} — try nearby freshwater or coastal zones.`;
  } else if (peakNow) {
    note = `Peak window now — ${profile.note.toLowerCase()}`;
  }

  return { rating, peakNow, note };
}

function getActiveSpecies(
  season: Season,
  timeOfDay: TimeOfDay,
  biome: Biome
): ActiveSpecies[] {
  return GLOBAL_SPECIES.map((profile) => {
    const { rating, peakNow, note } = scoreSpecies(profile, season, timeOfDay, biome);
    return {
      id: profile.id,
      name: profile.name,
      activityRating: rating,
      peakNow,
      note,
      activeTimes: profile.activeTimes,
    };
  }).sort((a, b) => b.activityRating - a.activityRating);
}

function getTackleRecommendations(
  season: Season,
  timeOfDay: TimeOfDay,
  biome: Biome,
  activeSpecies: ActiveSpecies[]
): TackleRecommendation[] {
  const topSpecies = activeSpecies.filter((s) => s.activityRating >= 3).slice(0, 3);
  const recommendations: TackleRecommendation[] = [];

  const add = (rec: TackleRecommendation) => {
    if (!recommendations.some((r) => r.name === rec.name)) {
      recommendations.push(rec);
    }
  };

  if (timeOfDay === 'Morning' || timeOfDay === 'Evening') {
    add({
      name: 'Topwater Popper',
      type: 'lure',
      reason: 'Low light triggers surface strikes from bass and snook near cover.',
    });
  }

  if (biome === 'Freshwater Lake' || biome === 'Freshwater River') {
    add({
      name: 'Soft Plastic Worm',
      type: 'lure',
      reason: 'Versatile bottom presentation — effective when fish hold on structure.',
    });
  }

  if (season === 'Spring') {
    add({
      name: 'Spinnerbait',
      type: 'lure',
      reason: 'Pre-spawn bass and pike chase flashy profiles in shallow water.',
    });
  }

  if (season === 'Summer' && timeOfDay === 'Midday') {
    add({
      name: 'Deep-Diving Crankbait',
      type: 'lure',
      reason: 'Fish retreat to thermocline — reach them at 12–20 ft depth.',
    });
  }

  if (biome === 'Coastal Saltwater' || biome === 'Tropical Estuary') {
    add({
      name: 'Live Shrimp',
      type: 'bait',
      reason: 'Universal saltwater bait — snook and inshore species cannot resist it.',
    });
    add({
      name: 'Gold Spoon',
      type: 'lure',
      reason: 'Flash mimics baitfish in stained estuary and surf zones.',
    });
  }

  if (timeOfDay === 'Night') {
    add({
      name: 'Live Minnow / Nightcrawler',
      type: 'bait',
      reason: 'Scent and vibration dominate after dark — walleye and catfish staple.',
    });
  }

  if (topSpecies.some((s) => s.name === 'Trout')) {
    add({
      name: 'Inline Spinner',
      type: 'lure',
      reason: 'Mimics fleeing baitfish — trout strike aggressively in current seams.',
    });
  }

  if (recommendations.length < 3) {
    add({
      name: 'Jig Head + Grub',
      type: 'lure',
      reason: 'All-purpose presentation adaptable to any depth or cover type.',
    });
  }

  return recommendations.slice(0, 5);
}

export function getFishingForecast(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): FishingForecast {
  const month = date.getMonth() + 1;
  const hour = date.getHours();
  const hemisphere = getHemisphere(latitude);
  const season = getSeason(month, hemisphere);
  const timeOfDay = getTimeOfDay(hour);
  const biome = estimateBiome(latitude, longitude);
  const waterConditions = getWaterConditions(season, timeOfDay, biome, hemisphere);
  const activeSpecies = getActiveSpecies(season, timeOfDay, biome);
  const tackleRecommendations = getTackleRecommendations(
    season,
    timeOfDay,
    biome,
    activeSpecies
  );

  const summary = `${season} ${timeOfDay} — ${biome} Conditions`;

  return {
    summary,
    hemisphere,
    season,
    timeOfDay,
    biome,
    waterConditions,
    activeSpecies,
    tackleRecommendations,
    generatedAt: date.toISOString(),
  };
}

export function getForecastSubtitle(forecast: FishingForecast): string {
  const monthName = MONTH_NAMES[new Date(forecast.generatedAt).getMonth()];
  return `${monthName} · ${forecast.hemisphere} Hemisphere · ${forecast.biome}`;
}

export function getActivityLabel(rating: ActivityRating): string {
  const labels: Record<ActivityRating, string> = {
    1: 'Slow',
    2: 'Fair',
    3: 'Good',
    4: 'Hot',
    5: 'Excellent',
  };
  return labels[rating];
}

export function getActivityColor(rating: ActivityRating): string {
  const colors: Record<ActivityRating, string> = {
    1: '#94A3B8',
    2: '#F59E0B',
    3: '#10B981',
    4: '#059669',
    5: '#047857',
  };
  return colors[rating];
}
