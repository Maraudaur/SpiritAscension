export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "boss";

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
export type StatType = "attack" | "defense" | "health" | "elementalAffinity" | "agility";
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

export interface SwapBuffTrapEffect {
  type: "swap_buff_trap";
  // Define the buff it will apply
  stat: StatType;
  value: number; // 0.5 for +50%
  buffDuration: number; // e.g., 5 turns
  // Define the trap itself
  trapDuration: number; // e.g., 3 turns
}

export interface HealEffect {
  type: "heal";
  healthRatio: number; // 0.3 for 30% of max health
  affinityRatio: number; // 0.3 for 0.3x affinity
}

export interface CritChanceBuffEffect {
  type: "crit_chance_buff";
  value: number; // 0.5 for +50%
  duration: number;
}

export interface LifestealBuffEffect {
  type: "lifesteal_buff";
  value: number; // 0.5 for 50% lifesteal
  duration: number;
}

export interface DamageReflectBuffEffect {
  type: "damage_reflect_buff";
  ratio: number; // 0.3 for 30% reflection
  duration: number;
}

export interface ApplyDotStackEffect {
  type: "apply_dot_stack";
  damageRatio: number; // 0.05 for 5% max HP per turn
  duration: number;
  stacks: number; // Number of stacks to apply
  maxStacks: number; // Maximum allowed stacks
  chance?: number; // 0.3 for 30% chance to apply (optional, defaults to 100%)
}

export type CustomEffect =
  | StatBuffEffect
  | DOTEffect
  | ThornsEffect
  | OneTimeShieldEffect
  | BasicAttackConversionEffect
  | HealEffect
  | SwapBuffTrapEffect
  | ChargeEffect
  | CritChanceBuffEffect
  | LifestealBuffEffect
  | DamageReflectBuffEffect
  | ApplyDotStackEffect;

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

export interface PassiveCritChanceBoost {
  type: "crit_chance_boost";
  value: number; // 0.2 for 20%
}

export interface PassiveDotDamageBoost {
  type: "dot_damage_boost";
  value: number; // 0.3 for 30% boost
}

export interface PassiveDamageReflect {
  type: "damage_reflect_passive";
  ratio: number; // 0.15 for 15% reflection
}

export interface PassiveCounterAttack {
  type: "counter_attack_chance";
  chance: number; // 0.5 for 50% chance
}

export interface SpiritSpriteConfig {
  textureUrl: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  animationSpeed: number;
}

export type PassiveEffect =
  | PassiveStatBoost
  | PassiveElementalLifesteal
  | PassiveDOTAttacker
  | PassiveCritChanceBoost
  | PassiveDotDamageBoost
  | PassiveDamageReflect
  | PassiveCounterAttack;

export type CombatTrigger =
  | "on_hit"
  | "on_get_hit"
  | "on_start_turn"
  | "on_end_turn"
  | "on_enter_battle"
  | "on_switch_out"
  | "on_switch_in"
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
  damageMultiplier?: number;
  healingFlat?: number;
  healingAffinityRatio?: number;
  element?: SkillElementId;
  targetIndex?: number; // The enemy index to hit
  casterStats?: {
    // Caster's stats at the moment of casting
    attack: number;
    affinity: number;
    level: number;
  };
  storedBuff?: {
    stat: StatType;
    value: number; // 0.5 for +50%
    duration: number; // 5 turns
  };
  critChanceBoost?: number; // For crit_chance_buff
  lifestealRatio?: number; // For lifesteal_buff
  damageReflectRatio?: number; // For damage_reflect_buff
  dotStacks?: number; // For tracking DoT stacks
  casterSpiritId?: string; // For DoT amplification - the spirit that cast this effect
  casterHasDotAmplification?: boolean; // Whether the caster has dot_amplification passive
}

export interface ChargeEffect {
  type: "charge";
  duration: number; // How many turns to charge
  damageMultiplier?: number;
  healingFlat?: number;
  healingAffinityRatio?: number;
  element?: SkillElementId;
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
  elements: ElementId[];
  lineage: LineageId;
  baseStats: {
    attack: number;
    defense: number;
    health: number;
    elementalAffinity: number;
    agility: number;
  };
  passiveAbilities: string[];
  skills: string[];
  triggeredAbilities?: TriggeredAbility[];
  spriteConfig?: SpiritSpriteConfig;
}

export interface PotentialFactors {
  attack: PotentialGrade;
  defense: PotentialGrade;
  health: PotentialGrade;
  elementalAffinity: PotentialGrade;
  agility: PotentialGrade;
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
