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

              const targetDisplayName = (target as Enemy).name || 
                (target as BattleSpirit).playerSpirit?.instanceId || "Unknown";
              
              addLog(
                `${targetDisplayName}'s "${passive.name}" passive poisons the attacker!`,
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
      (target as BattleSpirit).playerSpirit?.instanceId || (target as Enemy).name;

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

  // ========== Core Battle Functions ==========
  const startBattle = () => {
    if (playerSpirits.length === 0) return;
    setBattleState("fighting");
    setBattleRewards(null);
    addLog("Battle begins!");
    playBattleMusic();
  };

  const handleVictory = (targetEnemy: Enemy) => {
    setBattleState("victory");
    addLog("Victory! The enemy has been defeated!");

    let qiReward = 0;

    if (currentEncounter && !isBossBattle) {
      const rewards = currentEncounter.rewards;
      qiReward = rewards.qi;

      if (rewards.essences) {
        for (const [spiritId, amount] of Object.entries(rewards.essences)) {
          addEssence(spiritId, amount);
          addLog(
            `You obtained ${amount}x ${getBaseSpirit(spiritId)?.name} Essence!`,
          );
        }
      }
      setBattleRewards({ qi: qiReward, qiGeneration: 0.1 });
    } else {
      const baseQiReward = targetEnemy.level * 10;
      qiReward = Math.floor(baseQiReward * battleRewardMultiplier);
      const qiGenerationIncrease = 0.1;
      setBattleRewards({ qi: qiReward, qiGeneration: qiGenerationIncrease });
    }

    setPlayerSpirits((prev) =>
      prev.map((spirit) => ({
        ...spirit,
        currentHealth: spirit.maxHealth,
      })),
    );

    playerSpirits.forEach((spirit) => {
      const stats = calculateAllStats(spirit.playerSpirit);
      updateSpiritHealth(spirit.playerSpirit.instanceId, stats.health);
    });

    winBattle(qiReward);
  };

  const handleClose = () => {
    if (battleState !== "defeat") {
      playerSpirits.forEach((spirit) => {
        updateSpiritHealth(
          spirit.playerSpirit.instanceId,
          spirit.currentHealth,
        );
      });
    }
    playExploreMusic();
    onClose();
  };

  // ========== Battle Initialization ==========
  useEffect(() => {
    if (activeParty.length === 0) {
      setBattleLog([
        "No spirits in active party! Please add spirits to your party first.",
      ]);
      return;
    }

    const spiritsInBattle = activeParty
      .map((instanceId) => spirits.find((s) => s.instanceId === instanceId))
      .filter((s): s is PlayerSpirit => s !== undefined)
      .map((spirit) => {
        const stats = calculateAllStats(spirit);
        return {
          playerSpirit: spirit,
          maxHealth: stats.health,
          currentHealth: Math.min(
            spirit.currentHealth ?? stats.health,
            stats.health,
          ),
          activeEffects: spirit.activeEffects || [],
        };
      });
    setPlayerSpirits(spiritsInBattle);

    let logMessage = "";

    if (isBossBattle) {
      const bossEnemy = generateBossEnemy();
      setBattleEnemies([bossEnemy]);
      setActiveEnemyIndex(0);
      logMessage = `The ${bossEnemy.name} appears!`;
      setBattleLog([logMessage]);
    } else {
      const encounter = findEncounter();
      setCurrentEncounter(encounter);

      if (encounter && encounter.enemies.length > 0) {
        const allEnemies = encounter.enemies
          .map((enemyData, index) => {
            const baseSpirit = getBaseSpirit(enemyData.spiritId);
            if (!baseSpirit || !baseSpirit.baseStats) return null;

            const enemyPotentialBonus = 0.02;
            const levelMultiplier = enemyData.level * 0.02;
            const enemyAttack = Math.floor(
              baseSpirit.baseStats.attack *
                (1 + enemyPotentialBonus) *
                levelMultiplier,
            );
            const enemyDefense = Math.floor(
              baseSpirit.baseStats.defense *
                (1 + enemyPotentialBonus) *
                levelMultiplier,
            );
            const enemyHealth =
              Math.floor(
                baseSpirit.baseStats.health *
                  (1 + enemyPotentialBonus) *
                  levelMultiplier,
              ) + 10;
            const enemyElementalAffinity = Math.floor(
              baseSpirit.baseStats.elementalAffinity *
                (1 + enemyPotentialBonus) *
                levelMultiplier,
            );

            return {
              id: `enemy_${Date.now()}_${index}`,
              spiritId: enemyData.spiritId,
              name: baseSpirit.name,
              level: enemyData.level,
              attack: enemyAttack,
              defense: enemyDefense,
              maxHealth: enemyHealth,
              currentHealth: enemyHealth,
              element: baseSpirit.element,
              elementalAffinity: enemyElementalAffinity,
              activeEffects: [] as ActiveEffect[],
            };
          })
          .filter((e): e is Enemy => e !== null);

        if (allEnemies.length > 0) {
          setBattleEnemies(allEnemies);
          setActiveEnemyIndex(0);
          logMessage = `Encounter: ${encounter.name}!`;
          setBattleLog([logMessage]);
        } else {
          logMessage = "Could not load enemies for this encounter.";
          setBattleLog([logMessage]);
          console.error("Failed to create enemies from encounter data.");
        }
      } else {
        logMessage = "No valid encounter found for your level.";
        setBattleLog([logMessage]);
        console.error("Failed to find a valid encounter.");
      }
    }
  }, [activeParty, spirits, isBossBattle]);

  // ========== Combat Handler Functions ==========
  // Note: These functions are declared but will use stub implementations initially
  // The full battle logic from the original file needs to be added here
  const handleAttack = (skillId: string) => {
    // TODO: Add full implementation from BattleScreen.tsx lines 515-720
    console.log("handleAttack called with skillId:", skillId);
  };

  const enemyTurn = (specifiedTargetIndex?: number) => {
    // TODO: Add full implementation from BattleScreen.tsx lines 722-776
    console.log("enemyTurn called");
  };

  const executeBossTurn = (targetIndex: number, target: BattleSpirit, stats: any) => {
    // TODO: Add full implementation from BattleScreen.tsx lines 778-1077
    console.log("executeBossTurn called");
  };

  const executeNormalEnemyTurn = (targetIndex: number, target: BattleSpirit, stats: any) => {
    // TODO: Add full implementation from BattleScreen.tsx lines 1079-1337
    console.log("executeNormalEnemyTurn called");
  };

  const checkDefeat = (newHealth: number, targetIndex: number) => {
    // TODO: Add full implementation from BattleScreen.tsx lines 1339-1377
    if (newHealth <= 0) {
      console.log("Spirit defeated");
    }
  };

  const handleSwap = (index: number) => {
    if (battleState !== "fighting" || index === activePartySlot) return;
    if (playerSpirits[index].currentHealth <= 0) {
      addLog("Cannot swap to a defeated spirit!");
      return;
    }

    const oldSpirit = getBaseSpirit(
      playerSpirits[activePartySlot].playerSpirit.spiritId,
    );
    const newSpirit = getBaseSpirit(playerSpirits[index].playerSpirit.spiritId);

    setActivePartySlot(index);
    setActionMenu("none");
    setIsBlocking(false);
    addLog(`Swapped ${oldSpirit?.name} for ${newSpirit?.name}!`);

    setTimeout(() => enemyTurn(index), 800);
  };

  const handleBlock = () => {
    if (battleState !== "fighting") return;

    const currentSpirit = playerSpirits[activePartySlot];
    if (!currentSpirit || currentSpirit.currentHealth <= 0) return;

    const baseSpirit = getBaseSpirit(currentSpirit.playerSpirit.spiritId);
    setIsBlocking(true);
    setActionMenu("none");
    addLog(`${baseSpirit?.name} takes a defensive stance!`);

    setTimeout(() => enemyTurn(), 800);
  };

  const handleSkillSelect = (skillId: string) => {
    setActionMenu("none");
    handleAttack(skillId);
  };

  const handleContinueBattle = () => {
    const encounter = findEncounter();
    setCurrentEncounter(encounter);

    let newEnemies: Enemy[] = [];
    let logMessage = "No more encounters found at this level.";

    if (encounter && encounter.enemies.length > 0) {
      newEnemies = encounter.enemies
        .map((enemyData, index) => {
          const baseSpirit = getBaseSpirit(enemyData.spiritId);
          if (!baseSpirit || !baseSpirit.baseStats) return null;

          const enemyPotentialBonus = 0.02;
          const levelMultiplier = enemyData.level * 0.02;
          const enemyAttack = Math.floor(
            baseSpirit.baseStats.attack *
              (1 + enemyPotentialBonus) *
              levelMultiplier,
          );
          const enemyDefense = Math.floor(
            baseSpirit.baseStats.defense *
              (1 + enemyPotentialBonus) *
              levelMultiplier,
          );
          const enemyHealth =
            Math.floor(
              baseSpirit.baseStats.health *
                (1 + enemyPotentialBonus) *
                levelMultiplier,
            ) + 10;
          const enemyElementalAffinity = Math.floor(
            baseSpirit.baseStats.elementalAffinity *
              (1 + enemyPotentialBonus) *
              levelMultiplier,
          );

          return {
            id: `enemy_${Date.now()}_${index}`,
            spiritId: enemyData.spiritId,
            name: baseSpirit.name,
            level: enemyData.level,
            attack: enemyAttack,
            defense: enemyDefense,
            maxHealth: enemyHealth,
            currentHealth: enemyHealth,
            element: baseSpirit.element,
            elementalAffinity: enemyElementalAffinity,
            activeEffects: [] as ActiveEffect[],
          };
        })
        .filter((e): e is Enemy => e !== null);

      if (newEnemies.length > 0) {
        logMessage = `A new challenger appears: ${encounter.name}!`;
      } else {
        logMessage = "Could not load enemies for the next encounter.";
      }
    }

    if (newEnemies.length > 0) {
      setBattleEnemies(newEnemies);
      setActiveEnemyIndex(0);
      setBattleState("fighting");
      setBattleRewards(null);
      setActivePartySlot(0);
      setActionMenu("none");
      setIsBlocking(false);
      setBattleLog([logMessage, "The battle continues!"]);
    } else {
      setBattleLog([logMessage, "Please return to the main screen."]);
      setBattleState("setup");
    }
  };
  
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
    
    // Battle Flow Functions
    startBattle,
    handleVictory,
    handleClose,
    handleAttack,
    enemyTurn,
    executeBossTurn,
    executeNormalEnemyTurn,
    checkDefeat,
    
    // Player Action Handlers
    handleSwap,
    handleBlock,
    handleSkillSelect,
    handleContinueBattle,
  };
}
