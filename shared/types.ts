export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ElementId = "wood" | "earth" | "fire" | "water" | "metal" | "none";

export type LineageId =
  | "tiger"
  | "dragon"
  | "ox"
  | "serpent"
  | "horse"
  | "monkey";

export interface PassiveAbility {
  id: string;
  name: string;
  description: string;
  effects: PassiveEffect[];
}

export type PotentialGrade = "C" | "B" | "A" | "S" | "SS";

export type SkillElementId = ElementId | "none";

export type EffectTarget = "self" | "enemy" | "party_member";
export type StatType = "attack" | "defense" | "health" | "elementalAffinity";
/*** Defines the AI behavior for an enemy, e.g., a list of skill IDs to cycle through.*/
export type EnemyAI = string[];

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

export interface BasicAttackConversionEffect {
  type: "basic_attack_conversion";
  element: ElementId;
  duration: number;
}

export type CustomEffect =
  | StatBuffEffect
  | DOTEffect
  | ThornsEffect
  | OneTimeShieldEffect
  | BasicAttackConversionEffect;

export interface PassiveStatBoost {
  type: "stat_boost";
  stat: StatType;
  value: number; // 0.1 for 10%
}

export interface PassiveElementalLifesteal {
  type: "elemental_lifesteal";
  element: ElementId;
  ratio: number; // 0.3 for 30%
}

export interface PassiveDOTAttacker {
  type: "dot_attacker";
  damageRatio: number; // 0.125 for 12.5%
  duration: number;
}

export type PassiveEffect = PassiveStatBoost | PassiveElementalLifesteal| PassiveDOTAttacker;

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
  passiveAbilities: string[];
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
/**
 * Encounter Types Data
 */
export interface EncounterEnemy {
  spiritId: string; // ID from spirits.json
  level: number;
  ai: EnemyAI;
}

export interface EncounterReward {
  qi: number;
  essences?: Record<string, number>; // { [spiritId]: amount }
  // You could add items here later: items?: Record<string, number>;
}

export interface EncounterPenalty {
  qiLoss: number;
}

export interface Encounter {
  id: string;
  name: string;
  averageLevel: number; // The target player level for this encounter
  enemies: EncounterEnemy[];
  rewards: EncounterReward;
  penalties: EncounterPenalty;
}
