import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import { NearbySpot } from '@/utils/osmFishingSpots';
import { getOsmFishingSpots, mergeFishingSpots } from '@/utils/osmFishingSpots';
import { getLocalFishingSpots } from '@/lib/data/localSpots';
import speciesData from '@/data/species.json';
import { supabase, FishingSpot } from '@/lib/supabase';
import { calculateDistance, getCurrentMonth } from '@/utils/geo';

export interface FishingSpotsParams {
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  signal?: AbortSignal;
}

interface BffFishingSpotsResponse {
  spots: NearbySpot[];
}

/**
 * Primary entry — offline-first:
 * 1. Curated local dataset (bundled, always available, zero latency)
 * 2. BFF proxy when configured
 * 3. Direct OSM + Supabase fallback
 * Remote results are merged around the local dataset, never replacing it.
 */
export async function fetchNearbyFishingSpots({
  latitude,
  longitude,
  radiusMiles = 50,
  signal,
}: FishingSpotsParams): Promise<NearbySpot[]> {
  const localSpots = getLocalFishingSpots(latitude, longitude, radiusMiles);

  let remoteSpots: NearbySpot[] = [];

  if (isBffEnabled()) {
    try {
      const data = await bffRequest<BffFishingSpotsResponse>('/api/fishing-spots', {
        params: { lat: latitude, lon: longitude, radius: radiusMiles },
        signal,
      });
      remoteSpots = data.spots ?? [];
    } catch (error) {
      console.warn('BFF fishing spots unavailable, falling back to direct fetch:', error);
      remoteSpots = await fetchNearbyFishingSpotsDirect(latitude, longitude, radiusMiles);
    }
  } else {
    remoteSpots = await fetchNearbyFishingSpotsDirect(latitude, longitude, radiusMiles);
  }

  return mergeFishingSpots(localSpots, remoteSpots, 20);
}

async function fetchNearbyFishingSpotsDirect(
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<NearbySpot[]> {
  const currentMonth = getCurrentMonth();
  const osmSpots = await getOsmFishingSpots(latitude, longitude, Math.min(radiusMiles, 50));

  let supabaseSpots: NearbySpot[] = [];
  try {
    const { data, error } = await supabase.from('fishing_spots').select('*');

    if (!error && data) {
      supabaseSpots = data.map((spot: FishingSpot) => {
        const distance = calculateDistance(latitude, longitude, spot.latitude, spot.longitude);
        const speciesInSpot = speciesData.filter((s) => spot.species.includes(s.id));
        const speciesForCurrentMonth = speciesInSpot.filter((s) => s.bestMonths.includes(currentMonth));
        const isPeakSeason = spot.best_months.includes(currentMonth);

        return {
          ...spot,
          distance: Math.round(distance * 10) / 10,
          matchedSpecies: speciesForCurrentMonth.map((s) => s.name),
          isPeakSeason,
        };
      }).filter((spot) => spot.distance <= radiusMiles);
    }
  } catch (error) {
    console.error('Error fetching Supabase fishing spots:', error);
  }

  const combined = mergeFishingSpots(osmSpots, supabaseSpots);
  return combined.length > 0
    ? combined
    : supabaseSpots.sort((a, b) => a.distance - b.distance).slice(0, 10);
}
