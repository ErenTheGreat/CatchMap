export interface FishingSpotRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  species: string[];
  waterType: string;
  avgDepthFeet: number;
  underwaterStructure: string[];
  bestSeason: string;
  description: string;
}

declare const fishingData: FishingSpotRecord[];
export default fishingData;
