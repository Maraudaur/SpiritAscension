export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ElementId = "wood" | "earth" | "fire" | "water" | "metal" | "none";

export type LineageId =
  | "tiger"
  | "dragon"
  | "ox"
  | "serpent"
  | "horse"
  | "monkey";

export type PassiveAbility = "attack" | "defense" | "health";

export type PotentialGrade = "C" | "B" | "A" | "S" | "SS";

export type SkillElementId = ElementId | "none";

export type EffectTarget = "self" | "enemy" | "party_member";
export type StatType = "attack" | "defense" | "health" | "elementalAffinity";

export interface StatBuffEffect {
  type: "stat_buff" | "stat_debuff";
  stat: StatType;
  value: number;
  duration: number;
}

export interface DOTEffect {
  type: "damage_over_time";
  damagePerTurn: number;
  duration: number;
}

export interface ThornsEffect {
  type: "thorns";
  damageReturnRatio: number;
  duration: number;
}

export interface OneTimeShieldEffect {
  type: "one_time_shield";
}

export type CustomEffect =
  | StatBuffEffect
  | DOTEffect
  | ThornsEffect
  | OneTimeShieldEffect;

export type CombatTrigger =
  | "on_hit"
  | "on_get_hit"
  | "on_start_turn"
  | "on_end_turn"
  | "on_enter_battle"
  | "on_switch_out"
  | "on_knocked_out"
  | "check_party_element"
  | "check_party_lineage";

export interface ActiveEffect {
  id: string;
  effectType: CustomEffect["type"];
  turnsRemaining: number;
  stat?: StatType;
  statMultiplier?: number;
  damagePerTurn?: number;
  damageReturnRatio?: number;
  blocksFullHit?: boolean;
}

export interface TriggeredAbility {
  trigger: CombatTrigger;
  condition?: { type: "hp_threshold" | "party_count"; value: any };
  effects: CustomEffect[];
}

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
  element: SkillElementId;
  effects?: CustomEffect[];
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
  triggeredAbilities?: TriggeredAbility[];
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
  activeEffects?: ActiveEffect[];
}

export interface GameState {
  qi: number;
  qiPerSecond: number;
  qiUpgrades: {
    baseProduction: number;
    multiplier: number;
    baseProductionLevel: number;
    multiplierLevel: number;
  };
  battleRewardMultiplier: number;
  spirits: PlayerSpirit[];
  activeParty: string[];
  battlesWon: number;
  lastUpdate: number;
  essences: Record<string, number>;
  summonCount?: number;
}
