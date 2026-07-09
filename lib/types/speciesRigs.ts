export type RigType =
  | 'spinning'
  | 'baitcasting'
  | 'fly'
  | 'surf'
  | 'bottom'
  | 'trolling'
  | 'float'
  | 'jigging';

export type RigComponentRole =
  | 'rod'
  | 'reel'
  | 'line'
  | 'leader'
  | 'hook'
  | 'weight'
  | 'lure'
  | 'bait'
  | 'float'
  | 'swivel'
  | 'other';

export interface RigComponent {
  role: RigComponentRole;
  label: string;
  detail?: string;
}

export type RigTargetDepth = 'surface' | 'mid' | 'bottom';

export interface SpeciesRig {
  id: string;
  name: string;
  rigType: RigType;
  isPrimary: boolean;
  targetDepth?: RigTargetDepth;
  retrieve?: string;
  components: RigComponent[];
  steps?: string[];
  tip?: string;
  visualKey?: string;
}

export interface SpeciesRigsEntry {
  speciesId: string;
  rigs: SpeciesRig[];
}
