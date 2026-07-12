/**
 * BFF route contract — implement this on your backend proxy.
 *
 * GET /api/fishing-spots?lat={lat}&lon={lon}&radius={miles}
 * Response: { spots: NearbySpot[] }
 *
 * GET /api/weather?lat=&lon=
 * Response: WeatherSnapshot (see lib/api/endpoints/weather.ts)
 * Aggregate from Open-Meteo; cache ~15 min per rounded coordinate.
 *
 * GET /api/tides?lat=&lon=
 * Response: TidesResponse (see lib/api/endpoints/tides.ts)
 * Resolve nearest NOAA CO-OPS station server-side, then fetch predictions.
 *
 * GET /api/species?lat=&lon=
 * Response: SpeciesRecord[] (see lib/api/endpoints/speciesCatalog.ts)
 * Enrich bundled catalog with GBIF occurrence data for the region.
 */

export interface BffFishingSpotsRoute {
  method: 'GET';
  path: '/api/fishing-spots';
  query: {
    lat: number;
    lon: number;
    radius?: number;
  };
  response: {
    spots: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      water_type: string;
      distance: number;
      matchedSpecies: string[];
      isPeakSeason: boolean;
    }>;
  };
}
