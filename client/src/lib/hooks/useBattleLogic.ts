import { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  calculateAllStats,
  getAvailableSkills,
  getSkill,
  getRandomEnemy,
  getElementalDamageMultiplier,
} from "@/lib/spiritUtils";
import type {
  PlayerSpirit,
  ActiveEffect,
  BaseSpirit,
  ElementId,
  CustomEffect,
  PassiveAbility,
  PassiveElementalLifesteal,
  BasicAttackConversionEffect,
  StatBuffEffect,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";
import passivesData from "@shared/data/passives.json";
import type { Encounter } from "@shared/types";
import allEncounters from "@shared/data/encounters.json";
import type {
  ActionMenu,
  BattleState,
  BattleScreenProps,
  BattleSpirit,
  Enemy,
  BossBattleState,
  TriggerEffectResult,
  BattleRewards,
} from "@/lib/battle-types";

export function useBattleLogic({ onClose, isBossBattle = false }: BattleScreenProps) {
  // ========== Game State Hooks ==========
  const {
    spirits,
    activeParty,
    winBattle,
    addEssence,
    updateSpiritHealth,
    battleRewardMultiplier,
    healAllSpirits,
  } = useGameState();
  
  const {
    playDamage,
    playHeal,
    playButtonClick,
    playButtonHover,
    isMuted,
    toggleMute,
    playBattleMusic,
    playExploreMusic,
  } = useAudio();

  // ========== Battle State ==========
  const [battleState, setBattleState] = useState<BattleState>("setup");
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [battleEnemies, setBattleEnemies] = useState<Enemy[]>([]);
  const [activeEnemyIndex, setActiveEnemyIndex] = useState(0);
  const [battleRewards, setBattleRewards] = useState<BattleRewards | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenu>("none");
  const [isBlocking, setIsBlocking] = useState(false);
  const [playerHealthBarShake, setPlayerHealthBarShake] = useState(false);
  const [enemyHealthBarShake, setEnemyHealthBarShake] = useState(false);
  const [playerHealthBarHeal, setPlayerHealthBarHeal] = useState(false);
  const [bossState, setBossState] = useState<BossBattleState>({
    patternStep: 0,
    atkBuffTurnsRemaining: 0,
    isCharging: false,
  });
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);

  // ========== Derived Values ==========
  const activeEnemy = battleEnemies[activeEnemyIndex];
  const activeSpirit = playerSpirits[activePartySlot];
  
  const activeBaseSpirit = useMemo(
    () => (activeSpirit ? getBaseSpirit(activeSpirit.playerSpirit.spiritId) : null),
    [activeSpirit]
  );
  
  const activeStats = useMemo(
    () => (activeSpirit ? calculateAllStats(activeSpirit.playerSpirit) : null),
    [activeSpirit]
  );
  
  const availableSkills = useMemo(
    () => (activeSpirit ? getAvailableSkills(activeSpirit.playerSpirit) : []),
    [activeSpirit]
  );

  const canStartBattle = playerSpirits.length > 0 && battleEnemies.length > 0;

  // ========== Helper Functions ==========
  const addLog = (message: string) => {
    setBattleLog((prev) => [...prev, message]);
  };

  const generateBossEnemy = (): Enemy => {
    const bossSpirit = getBaseSpirit("boss_01");
    if (!bossSpirit) {
      return {
        id: "boss_" + Date.now(),
        spiritId: "boss_01",
        name: "Heavenly Warlord",
        level: 10,
        attack: 300,
        defense: 150,
        maxHealth: 1500,
        currentHealth: 1500,
        baseAttack: 300,
        element: "fire",
        elementalAffinity: 50,
        activeEffects: [],
      };
    }

    const level = 10;
    const stats = calculateAllStats({
      instanceId: "boss_temp",
      spiritId: "boss_01",
      level,
      experience: 0,
      isPrismatic: false,
      potentialFactors: {
        attack: "C",
        defense: "C",
        health: "C",
        elementalAffinity: "C",
      },
    });

    return {
      id: "boss_" + Date.now(),
      spiritId: "boss_01",
      name: bossSpirit.name,
      level,
      attack: stats.attack,
      defense: stats.defense,
      maxHealth: stats.health,
      currentHealth: stats.health,
      baseAttack: stats.attack,
      element: bossSpirit.element,
      elementalAffinity: stats.elementalAffinity,
      activeEffects: [],
    };
  };

  const getPlayerAverageLevel = () => {
    if (activeParty.length === 0) return 1;

    const partySpirits = activeParty.map((instanceId) =>
      spirits.find((s) => s.instanceId === instanceId),
    );

    const totalLevel = partySpirits.reduce((sum, spirit) => {
      return sum + (spirit?.level || 1);
    }, 0);

    return Math.max(1, Math.round(totalLevel / activeParty.length));
  };

  const findEncounter = (): Encounter | null => {
    const playerLevel = getPlayerAverageLevel();
    const encounterData = (allEncounters as any)?.default || allEncounters;
    if (!encounterData) {
      console.error("CRITICAL: encounters.json data is not loaded.");
      return null;
    }

    const levelRange = {
      min: playerLevel - 1,
      max: playerLevel + 1,
    };

    const validEncounters = (encounterData as Encounter[]).filter(
      (encounter) =>
        encounter.averageLevel >= levelRange.min &&
        encounter.averageLevel <= levelRange.max,
    );

    if (validEncounters.length === 0) {
      console.warn(`No encounters found for player level ${playerLevel}`);
      return (encounterData as Encounter[])[0] || null;
    }

    const randomIndex = Math.floor(Math.random() * validEncounters.length);
    return validEncounters[randomIndex];
  };

  // ========== Effect & Combat Functions ==========
  const executeTriggerEffects = (
    trigger: string,
    attacker: BattleSpirit | Enemy,
    target: BattleSpirit | Enemy | null,
    damage?: number,
  ): TriggerEffectResult => {
    let reflectedDamage = 0;
    const attackerEffects: ActiveEffect[] = [];

    if (trigger === "on_get_hit" && target && damage && damage > 0) {
      // 1. Check Target's Active Effects (Thorns buff)
      if ("activeEffects" in target) {
        const battleSpirit = target as BattleSpirit;
        battleSpirit.activeEffects.forEach((effect) => {
          if (
            effect.effectType === "thorns" &&
            effect.damageReturnRatio &&
            damage
          ) {
            reflectedDamage = Math.floor(damage * effect.damageReturnRatio);
            addLog(
              `${battleSpirit.playerSpirit.instanceId}'s Thorns reflects ${reflectedDamage} damage!`,
            );
          }
        });
      }

      // 2. Check Target's Passive Abilities
      const targetSpiritId =
        (target as BattleSpirit).playerSpirit?.spiritId ||
        (target as Enemy).spiritId;

      const targetBaseSpirit = getBaseSpirit(targetSpiritId);

      if (targetBaseSpirit && targetBaseSpirit.passiveAbilities) {
        for (const passiveId of targetBaseSpirit.passiveAbilities) {
          const passive = (passivesData as Record<string, PassiveAbility>)[
            passiveId
          ];
          if (!passive || !passive.effects) continue;

          for (const effect of passive.effects) {
            if (effect.type === "dot_attacker") {
              const targetMaxHealth =
                (target as BattleSpirit).maxHealth ||
                (target as Enemy).maxHealth;

              const dotDamage = Math.floor(
                targetMaxHealth * effect.damageRatio,
              );

              addLog(
                `${target.name}'s "${passive.name}" passive poisons the attacker!`,
              );

              attackerEffects.push({
                id: `dot_${Date.now()}`,
                effectType: "damage_over_time",
                turnsRemaining: effect.duration,
                damagePerTurn: dotDamage,
              });
            }
          }
        }
      }
    }
    return { reflectedDamage, attackerEffects };
  };

  const applyStatusEffect = (
    target: BattleSpirit | Enemy,
    effect: ActiveEffect,
  ): BattleSpirit | Enemy => {
    let targetName =
      (target as BattleSpirit).playerSpirit?.instanceId || target.name;

    const newEffect = { ...effect, id: `${effect.effectType}_${Date.now()}` };

    addLog(`${targetName} is afflicted with ${effect.effectType}!`);
    return {
      ...target,
      activeEffects: [...target.activeEffects, newEffect],
    };
  };

  const tickEffects = (
    spirits: BattleSpirit[],
    enemyState: Enemy | null,
  ): { updatedSpirits: BattleSpirit[]; updatedEnemy: Enemy | null } => {
    const updatedSpirits = spirits.map((spirit) => {
      let currentHealth = spirit.currentHealth;

      // Apply DOT damage from active effects
      spirit.activeEffects.forEach((effect) => {
        if (effect.effectType === "damage_over_time" && effect.damagePerTurn) {
          const dotDamage = effect.damagePerTurn;
          currentHealth = Math.max(0, currentHealth - dotDamage);
          addLog(
            `${spirit.playerSpirit.instanceId} takes ${dotDamage} damage from ${effect.effectType}!`,
          );
        }
      });

      // Decrement turnsRemaining and filter expired effects
      const activeEffects = spirit.activeEffects
        .map((effect) => ({
          ...effect,
          turnsRemaining: effect.turnsRemaining - 1,
        }))
        .filter((effect) => effect.turnsRemaining > 0);

      return {
        ...spirit,
        currentHealth,
        activeEffects,
      };
    });

    return { updatedSpirits, updatedEnemy: enemyState };
  };

  // This function will be defined in the next section along with the rest of the battle logic
  // I'll continue building this in the next file write
  
  return {
    // State
    battleState,
    activePartySlot,
    battleLog,
    playerSpirits,
    battleEnemies,
    activeEnemyIndex,
    activeEnemy,
    battleRewards,
    actionMenu,
    isBlocking,
    playerHealthBarShake,
    enemyHealthBarShake,
    playerHealthBarHeal,
    bossState,
    currentEncounter,
    
    // Derived
    activeSpirit,
    activeBaseSpirit,
    activeStats,
    availableSkills,
    canStartBattle,
    
    // Actions
    setActionMenu,
    setBattleState,
    setActivePartySlot,
    setPlayerSpirits,
    setBattleEnemies,
    setActiveEnemyIndex,
    setBattleRewards,
    setIsBlocking,
    setPlayerHealthBarShake,
    setEnemyHealthBarShake,
    setPlayerHealthBarHeal,
    setBossState,
    setBattleLog,
    
    // Audio
    playDamage,
    playHeal,
    playButtonClick,
    playButtonHover,
    isMuted,
    toggleMute,
    playBattleMusic,
    playExploreMusic,
    
    // Game State Actions
    winBattle,
    addEssence,
    updateSpiritHealth,
    battleRewardMultiplier,
    healAllSpirits,
    
    // Helper Functions
    addLog,
    generateBossEnemy,
    getPlayerAverageLevel,
    findEncounter,
    executeTriggerEffects,
    applyStatusEffect,
    tickEffects,
  };
}
