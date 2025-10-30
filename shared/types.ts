export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ElementId = 'wood' | 'earth' | 'fire' | 'water' | 'metal';

export type LineageId = 'tiger' | 'dragon' | 'ox' | 'serpent' | 'horse' | 'monkey';

export type PassiveAbility = 'attack' | 'defense' | 'health';

export type PotentialGrade = 'C' | 'B' | 'A' | 'S' | 'SS';

export interface Element {
  id: ElementId;
  name: string;
  color: string;
  description: string;
}

export interface Lineage {
  id: LineageId;
  name: string;
  description: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  damage: number;
  healing: number;
  unlockLevel: number;
}

export interface BaseSpirit {
  id: string;
  name: string;
  rarity: Rarity;
  element: ElementId;
  lineage: LineageId;
  baseStats: {
    attack: number;
    defense: number;
    health: number;
    elementalAffinity: number;
  };
  passiveAbility: PassiveAbility;
  skills: string[];
}

export interface PotentialFactors {
  attack: PotentialGrade;
  defense: PotentialGrade;
  health: PotentialGrade;
  elementalAffinity: PotentialGrade;
}

export interface PlayerSpirit {
  instanceId: string;
  spiritId: string;
  level: number;
  experience: number;
  isPrismatic: boolean;
  potentialFactors: PotentialFactors;
  currentHealth?: number;
}

export interface GameState {
  qi: number;
  qiPerSecond: number;
  qiUpgrades: {
    baseProduction: number;
    multiplier: number;
  };
  battleRewardMultiplier: number;
  spirits: PlayerSpirit[];
  activeParty: string[];
  battlesWon: number;
  lastUpdate: number;
  essences: Record<string, number>;
}
