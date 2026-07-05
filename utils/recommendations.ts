import speciesData from '@/data/species.json';
import { fetchNearbyFishingSpots } from '@/lib/api/endpoints/fishingSpots';
import { getCurrentMonth, getRegionFromCoordinates, calculateDistance, Region } from '@/utils/geo';
import { NearbySpot } from '@/utils/osmFishingSpots';

export type { Region, NearbySpot };

export type WaterType = 'lake' | 'river' | 'pond' | 'stream' | 'coastal';

export interface RecommendedSpecies {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  description: string;
  averageWeight: string;
  maxWeight: string;
  season: string;
  bestMonths: number[];
  peakMonths: number[];
  regions: string[];
  waterTypes: string[];
  lures: string[];
  image: string;
  tips: string;
  score: number;
  isPeak: boolean;
  recommendedLure: string;
}

const US_REGIONS: { [key: string]: Region[] } = {
  // Pacific Northwest
  '45.5,-122.6': ['northwest'],
  '47.6,-122.3': ['northwest'],
  '44.0,-123.0': ['northwest'],
  // California
  '37.7,-122.4': ['west'],
  '34.0,-118.2': ['west'],
  // Northeast
  '42.3,-71.0': ['northeast'],
  '40.7,-74.0': ['northeast'],
  '44.2,-69.0': ['northeast'],
  // Southeast
  '33.7,-84.3': ['southeast'],
  '30.2,-97.7': ['southwest'],
  '25.7,-80.2': ['south', 'southeast'],
  '29.7,-95.3': ['south'],
  // Midwest
  '41.8,-87.6': ['midwest'],
  '44.9,-93.2': ['midwest'],
  '39.0,-86.1': ['midwest'],
  '42.3,-83.0': ['midwest'],
};

export { getCurrentMonth, getRegionFromCoordinates, calculateDistance };

export function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}

export function getSpeciesRecommendations(
  latitude: number | null,
  longitude: number | null,
  waterType?: WaterType
): RecommendedSpecies[] {
  const currentMonth = getCurrentMonth();
  let regions: Region[] = ['midwest', 'northeast', 'southeast', 'northwest', 'southwest', 'south', 'west'];

  if (latitude !== null && longitude !== null) {
    regions = getRegionFromCoordinates(latitude, longitude);
  }

  const recommendations: RecommendedSpecies[] = speciesData
    .filter(species => {
      const regionMatch = species.regions.some(r => regions.includes(r as Region));
      if (!regionMatch) return false;

      if (waterType && !species.waterTypes.includes(waterType)) return false;

      return true;
    })
    .map(species => {
      const isPeak = species.peakMonths.includes(currentMonth);
      const isInSeason = species.bestMonths.includes(currentMonth);

      let score = 0;
      if (isPeak) score += 50;
      else if (isInSeason) score += 30;
      else score += 10;

      score += species.regions.filter(r => regions.includes(r as Region)).length * 5;

      const regionBonus = regions.includes('south') || regions.includes('southwest') || regions.includes('southeast') ?
        (species.bestMonths.includes(currentMonth) ? 5 : 0) : 0;
      score += regionBonus;

      const recommendedLure = species.lures[Math.floor(Math.random() * species.lures.length)];

      return {
        ...species,
        score: Math.min(score, 100),
        isPeak,
        recommendedLure,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return recommendations;
}

export function getTimeOfDayRecommendation(): { period: string; tip: string } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 9) {
    return {
      period: 'Early Morning',
      tip: 'Prime fishing time! Fish are actively feeding. Try topwater lures for bass, streamers for trout.'
    };
  } else if (hour >= 9 && hour < 12) {
    return {
      period: 'Late Morning',
      tip: 'Fish are moving to deeper water. Slow down your presentation and target structure.'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      period: 'Afternoon',
      tip: 'Fish may be sluggish. Try fishing deeper or in shaded areas. Catfish and carp are active.'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      period: 'Evening',
      tip: 'Second prime time! Fish move shallow to feed. Great time for topwater and shallow crankbaits.'
    };
  } else {
    return {
      period: 'Night',
      tip: 'Catfish, walleye, and crappie are active. Use live bait or glow-in-the-dark lures.'
    };
  }
}

export function getWeatherRecommendation(temperature: number): { tip: string; recommendedLures: string[] } {
  if (temperature < 40) {
    return {
      tip: 'Cold water slows fish metabolism. Fish slowly with jigs near bottom. Cold fronts can make them finicky.',
      recommendedLures: ['Jigs', 'Live bait', 'Slow-rolled spinnerbaits', 'Spoons']
    };
  } else if (temperature < 60) {
    return {
      tip: 'Active feeding period before spawn. Fish are moving into shallow areas. Crankbaits and swimbaits work well.',
      recommendedLures: ['Crankbaits', 'Swimbaits', 'Spinnerbaits']
    };
  } else if (temperature < 80) {
    return {
      tip: 'Optimal temperatures. Fish are actively feeding. Topwater early morning, deeper structure midday.',
      recommendedLures: ['Topwater', 'Soft plastics', 'Crankbaits', 'Jigs']
    };
  } else {
    return {
      tip: 'Hot weather pushes fish deep. Fish early morning, late evening, or at night. Deep structure is key.',
      recommendedLures: ['Deep-diving crankbaits', 'Heavy jigs', 'Carolina rig', 'Drop shot']
    };
  }
}

export async function getNearbyFishingSpots(
  latitude: number,
  longitude: number,
  radiusMiles: number = 100
): Promise<NearbySpot[]> {
  return fetchNearbyFishingSpots({ latitude, longitude, radiusMiles });
}

export function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function getWaterTypeIcon(waterType: string): string {
  switch (waterType) {
    case 'lake':
      return 'Lake';
    case 'river':
      return 'River';
    case 'pond':
      return 'Pond';
    case 'bay':
      return 'Bay';
    case 'coastal':
      return 'Coastal';
    default:
      return 'Water';
  }
}
