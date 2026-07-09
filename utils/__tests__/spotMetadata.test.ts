import { describe, expect, it } from 'vitest';
import {
  enrichNearbySpotFromLocation,
  formatSpotSpeciesSubtitle,
  isGenericSpotName,
  resolveSpotDisplayName,
} from '@/utils/spotMetadata';

describe('spotMetadata', () => {
  describe('isGenericSpotName', () => {
    it('flags empty and generic labels', () => {
      expect(isGenericSpotName('')).toBe(true);
      expect(isGenericSpotName('Fishing Spot')).toBe(true);
      expect(isGenericSpotName('Documented Fish Location')).toBe(true);
      expect(isGenericSpotName('Documented: Largemouth Bass')).toBe(true);
    });

    it('keeps real place names', () => {
      expect(isGenericSpotName('Shadow Cliffs Lake')).toBe(false);
      expect(isGenericSpotName('Arroyo del Valle Creek')).toBe(false);
    });
  });

  describe('resolveSpotDisplayName', () => {
    it('keeps curated names', () => {
      expect(
        resolveSpotDisplayName({
          name: 'Columbia River',
          waterType: 'freshwater',
        })
      ).toBe('Columbia River');
    });

    it('derives a label from category when name is generic', () => {
      expect(
        resolveSpotDisplayName({
          name: 'Fishing Spot',
          waterType: 'freshwater',
          category: 'Creek',
        })
      ).toBe('Creek access');
    });

    it('replaces GBIF documented species titles with a place label', () => {
      const enriched = enrichNearbySpotFromLocation({
        id: 'gbif-1',
        name: 'Documented: Rainbow Trout',
        description: null,
        latitude: 37.77,
        longitude: -122.42,
        water_type: 'lake',
        species: [],
        facilities: [],
        best_months: [],
        rating: 3.5,
        created_at: '2026-01-01',
        distance: 0.5,
        matchedSpecies: ['Rainbow Trout'],
        isPeakSeason: false,
      });

      expect(enriched.name).toBe('Lake fishing area');
      expect(enriched.matchedSpecies).toEqual(['Rainbow Trout']);
      expect(formatSpotSpeciesSubtitle(enriched)).toContain('Rainbow Trout');
    });
  });

  describe('enrichNearbySpotFromLocation', () => {
    it('does not hydrate synthetic species for postgis-style rows', () => {
      const enriched = enrichNearbySpotFromLocation(
        {
          id: 'postgis-abc',
          name: 'Clear Lake',
          description: null,
          latitude: 38.96,
          longitude: -122.76,
          water_type: 'freshwater',
          species: [],
          facilities: [],
          best_months: [],
          rating: 4,
          created_at: '2026-01-01',
          distance: 1.2,
        },
        { category: 'Lake' }
      );

      expect(enriched.matchedSpecies).toEqual([]);
      expect(enriched.species).toEqual([]);
      expect(enriched.name).toBe('Clear Lake');
    });

    it('uses water-type subtitle for generic OSM pins without synthetic species', () => {
      const enriched = enrichNearbySpotFromLocation({
        id: 'osm-node-1',
        name: 'Fishing Spot',
        description: null,
        latitude: 37.77,
        longitude: -122.42,
        water_type: 'lake',
        species: [],
        facilities: [],
        best_months: [],
        rating: 4,
        created_at: '2026-01-01',
        distance: 0.5,
      });

      expect(enriched.matchedSpecies).toEqual([]);
      expect(formatSpotSpeciesSubtitle(enriched)).toBe('Lake fishing');
    });
  });
});
