import type { PlayerSpirit, ActiveEffect, ElementId } from "@shared/types";

export type ActionMenu = "none" | "skills" | "swap";

export type BattleState =
  | "setup"
  | "fighting"
  | "victory"
  | "defeat"
  | "enemy_defeated";

export interface BattleScreenProps {
  onClose: () => void;
  onNavigate?: (screen: "story" | "cultivation" | "spirits" | "summon" | "battle") => void;
  isBossBattle?: boolean;
  returnTo?: "cultivation" | "story";
  autoStart?: boolean;
  onDefeatAnimationComplete?: () => void;
}

export interface BattleSpirit {
  playerSpirit: PlayerSpirit;
  currentHealth: number;
  maxHealth: number;
  activeEffects: ActiveEffect[];
}

export interface Enemy {
  id: string;
  spiritId: string;
  name: string;
  level: number;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  agility: number;
  baseAttack?: number;
  elements: ElementId[];
  elementalAffinity: number;
  activeEffects: ActiveEffect[];
}

export interface BossBattleState {
  patternStep: number;
  atkBuffTurnsRemaining: number;
  isCharging: boolean;
}

export interface TriggerEffectResult {
  reflectedDamage: number;
  attackerEffects: ActiveEffect[];
  counterAttackDamage: number;
}

export interface BattleRewards {
  qi: number;
  qiGeneration: number;
}
