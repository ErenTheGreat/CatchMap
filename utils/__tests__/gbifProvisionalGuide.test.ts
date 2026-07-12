import { describe, it, expect } from 'vitest';
import { buildGbifProvisionalRig, buildGbifProvisionalHowToCatch } from '@/utils/gbifProvisionalGuide';
import type { AvailableSpecies } from '@/lib/types/speciesPrediction';

const sampleSpecies: AvailableSpecies = {
  id: 'gbif-1',
  name: 'Striped Mullet',
  scientificName: 'Mugil cephalus',
  imageUrl: null,
  feedingZone: 'surface',
  idealTempMin: 18,
  idealTempMax: 28,
  monthStart: 1,
  monthEnd: 12,
  source: 'gbif_discovered',
  inCatalog: false,
};

describe('gbifProvisionalGuide', () => {
  it('builds provisional rig for GBIF species', () => {
    const rig = buildGbifProvisionalRig(sampleSpecies);
    expect(rig.isPrimary).toBe(true);
    expect(rig.components.length).toBeGreaterThan(3);
    expect(rig.name).toContain('Striped Mullet');
  });

  it('builds how-to text with scientific name', () => {
    const text = buildGbifProvisionalHowToCatch(sampleSpecies);
    expect(text).toContain('Mugil cephalus');
    expect(text).toContain('documented');
  });
});
