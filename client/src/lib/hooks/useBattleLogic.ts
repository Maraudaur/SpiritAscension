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

export function useBattleLogic({
  onClose,
  isBossBattle = false,
}: BattleScreenProps) {
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
  const [battleRewards, setBattleRewards] = useState<BattleRewards | null>(
    null,
  );
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
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(
    null,
  );

  // ========== Derived Values ==========
  const activeEnemy = battleEnemies[activeEnemyIndex];
  const activeSpirit = playerSpirits[activePartySlot];

  const activeBaseSpirit = useMemo(
    () =>
      activeSpirit ? getBaseSpirit(activeSpirit.playerSpirit.spiritId) : null,
    [activeSpirit],
  );

  const activeStats = useMemo(
    () => (activeSpirit ? calculateAllStats(activeSpirit.playerSpirit) : null),
    [activeSpirit],
  );

  const availableSkills = useMemo(
    () => (activeSpirit ? getAvailableSkills(activeSpirit.playerSpirit) : []),
    [activeSpirit],
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

              const targetDisplayName =
                (target as Enemy).name ||
                (target as BattleSpirit).playerSpirit?.instanceId ||
                "Unknown";

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
      (target as BattleSpirit).playerSpirit?.instanceId ||
      (target as Enemy).name;

    const newEffect = { ...effect, id: `${effect.effectType}_${Date.now()}` };

    addLog(`${targetName} is afflicted with ${effect.effectType}!`);
    return {
      ...target,
      activeEffects: [...target.activeEffects, newEffect],
    };
  };

  const tickEffects = (
    spirits: BattleSpirit[],
    enemies: Enemy[],
  ): { updatedSpirits: BattleSpirit[]; updatedEnemies: Enemy[] } => {
    let newEnemies = [...enemies]; // Create a mutable copy of enemies

    const updatedSpirits = spirits.map((spirit, spiritIndex) => {
      let currentHealth = spirit.currentHealth;
      const newActiveEffects: ActiveEffect[] = [];

      spirit.activeEffects.forEach((effect) => {
        let effectTicked = false; // Flag to see if we should tick down

        // --- 1. Handle DOT ---
        if (effect.effectType === "damage_over_time" && effect.damagePerTurn) {
          const dotDamage = effect.damagePerTurn;
          currentHealth = Math.max(0, currentHealth - dotDamage);
          addLog(
            `${spirit.playerSpirit.instanceId} takes ${dotDamage} damage from ${effect.effectType}!`,
          );
          effectTicked = true;
        }

        // --- 2. Handle Charge Effect ---
        else if (
          effect.effectType === "charge" &&
          effect.turnsRemaining === 1 && // This is the turn it hits
          effect.casterStats
        ) {
          effectTicked = true; // Effect is "used up"
          addLog(`${spirit.playerSpirit.instanceId} unleashes its attack!`);

          const { level, attack, affinity } = effect.casterStats;

          // --- A. DAMAGE COMPONENT ---
          if (effect.damageMultiplier && effect.targetIndex !== undefined) {
            const target = newEnemies[effect.targetIndex];
            if (!target || target.currentHealth <= 0) {
              addLog(`...but the target is already defeated!`);
            } else {
              // --- Re-run the damage calculation from handleAttack ---
              const defense = Math.max(1, target.defense);
              const affinityRatio = 0.25; // Base affinity ratio
              const attackElement = effect.element || "none";

              const STATIC_BASE_POWER = 60;
              const GAME_SCALING_FACTOR = 50;
              const levelComponent = Math.floor((2 * level) / 5) + 2;
              const attackDefenseRatio = attack / defense;
              const baseCalculation =
                Math.floor(
                  (levelComponent * STATIC_BASE_POWER * attackDefenseRatio) /
                    GAME_SCALING_FACTOR,
                ) + 2;

              const physicalDamage = Math.max(
                1,
                Math.floor(baseCalculation * (effect.damageMultiplier || 1.0)),
              );

              const baseElementalDamage = Math.floor(affinity * affinityRatio);
              const elementalMultiplier = getElementalDamageMultiplier(
                attackElement,
                target.element,
              );

              let totalDamage = 0;
              if (attackElement === "none") {
                const finalElementalDamage = Math.floor(
                  baseElementalDamage * elementalMultiplier,
                );
                totalDamage = physicalDamage + finalElementalDamage;
              } else {
                const totalBaseDamage = physicalDamage + baseElementalDamage;
                totalDamage = Math.max(
                  1,
                  Math.floor(totalBaseDamage * elementalMultiplier),
                );
              }
              // --- End Damage Calc ---

              const newEnemyHealth = Math.max(
                0,
                target.currentHealth - totalDamage,
              );
              addLog(`It dealt ${totalDamage} damage to ${target.name}!`);
              playDamage();
              setEnemyHealthBarShake(true);
              setTimeout(() => setEnemyHealthBarShake(false), 500);

              // Update the enemy in our mutable array
              newEnemies = newEnemies.map((en, i) =>
                i === effect.targetIndex
                  ? { ...en, currentHealth: newEnemyHealth }
                  : en,
              );

              // TODO: This doesn't trigger victory check.
              // This is a known limitation for now.
            }
          }

          // --- B. HEAL COMPONENT ---
          if (effect.healingFlat || effect.healingAffinityRatio) {
            const flatHeal = effect.healingFlat || 0;
            const affinityHeal = Math.floor(
              affinity * (effect.healingAffinityRatio || 0),
            );
            const totalHeal = flatHeal + affinityHeal;

            if (totalHeal > 0) {
              currentHealth = Math.min(
                spirit.maxHealth,
                currentHealth + totalHeal,
              );
              addLog(
                `${spirit.playerSpirit.instanceId} heals for ${totalHeal} HP!`,
              );
              playHeal();
              setPlayerHealthBarHeal(true);
              setTimeout(() => setPlayerHealthBarHeal(false), 600);
            }
          }
        }

        // --- 3. Tick Down Timer ---
        if (!effectTicked && effect.turnsRemaining > 1) {
          // Effect is still charging/waiting, tick down
          newActiveEffects.push({
            ...effect,
            turnsRemaining: effect.turnsRemaining - 1,
          });
        }
        // If effectTicked is true OR turnsRemaining is 1, it's done.
      });

      return {
        ...spirit,
        currentHealth,
        activeEffects: newActiveEffects,
      };
    });

    // --- FIX: Added enemy effect ticking ---
    const updatedEnemies = newEnemies.map((enemy) => {
      let currentHealth = enemy.currentHealth;
      const newActiveEffects: ActiveEffect[] = [];

      enemy.activeEffects.forEach((effect) => {
        let effectTicked = false;

        // --- 1. Handle DOT ---
        if (effect.effectType === "damage_over_time" && effect.damagePerTurn) {
          const dotDamage = effect.damagePerTurn;
          currentHealth = Math.max(0, currentHealth - dotDamage);
          addLog(
            `${enemy.name} takes ${dotDamage} damage from ${effect.effectType}!`,
          );
          effectTicked = true;
        }

        // --- 2. Handle Charge Effect (Enemy Caster) ---
        else if (
          effect.effectType === "charge" &&
          effect.turnsRemaining === 1 && // This is the turn it hits
          effect.casterStats
        ) {
          effectTicked = true; // Effect is "used up"
          addLog(`${enemy.name} unleashes its ability!`);

          const { level, attack, affinity } = effect.casterStats;

          // --- A. DAMAGE COMPONENT (Enemy hits Player) ---
          if (effect.damageMultiplier && effect.targetIndex !== undefined) {
            // NOTE: This logic is not fully implemented, as it would require
            // cross-modifying the `updatedSpirits` array, which is complex.
            // For now, we assume enemy charge attacks are self-target (heals).
            addLog(`...but enemy charge attacks are not fully implemented.`);
          }

          // --- B. HEAL COMPONENT (Enemy heals self) ---
          if (effect.healingFlat || effect.healingAffinityRatio) {
            const flatHeal = effect.healingFlat || 0;
            const affinityHeal = Math.floor(
              affinity * (effect.healingAffinityRatio || 0),
            );
            const totalHeal = flatHeal + affinityHeal;

            if (totalHeal > 0) {
              currentHealth = Math.min(
                enemy.maxHealth,
                currentHealth + totalHeal,
              );
              addLog(`${enemy.name} heals for ${totalHeal} HP!`);
              playHeal();
              // TODO: Add enemy heal flash
            }
          }
        }

        // --- 3. Tick Down Timer ---
        if (!effectTicked && effect.turnsRemaining > 1) {
          newActiveEffects.push({
            ...effect,
            turnsRemaining: effect.turnsRemaining - 1,
          });
        }
      });

      return {
        ...enemy,
        currentHealth,
        activeEffects: newActiveEffects,
      };
    });

    return { updatedSpirits, updatedEnemies };
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

  const handleAttack = (skillId: string) => {
    if (
      !activeEnemy ||
      battleState !== "fighting" ||
      playerSpirits.length === 0
    )
      return;

    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;

    const skill = getSkill(skillId);
    if (!activeStats) return; // Should not happen if activeSpirit is present
    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);

    if (!skill || !baseSpirit) return;

    // --- 1. Determine Elemental Properties and Affinity Ratio ---
    const spiritElement: ElementId = baseSpirit.element;
    const affinityStat = activeStats.elementalAffinity;
    const skillElement = skill.element;

    let affinityRatio = 0;
    if (skillElement === "none" || skillElement === spiritElement) {
      affinityRatio = 0.25; // Normal attack or matching element uses 0.25
    } else {
      affinityRatio = 0.15; // Mismatched element uses 0.15
    }
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // --- 2. Calculate BASE Physical Damage Component (NEW FORMULA) ---
    const level = activeSpirit.playerSpirit.level;
    const attack = activeStats.attack;
    const defense = Math.max(1, activeEnemy.defense);
    const STATIC_BASE_POWER = 60;
    const GAME_SCALING_FACTOR = 50;
    const levelComponent = Math.floor((2 * level) / 5) + 2;
    const attackDefenseRatio = attack / defense;
    const baseCalculation =
      Math.floor(
        (levelComponent * STATIC_BASE_POWER * attackDefenseRatio) /
          GAME_SCALING_FACTOR,
      ) + 2;
    const physicalDamage = Math.max(
      1, // Ensures at least 1 damage
      Math.floor(baseCalculation * skill.damage),
    );

    // --- 3. Calculate BASE Elemental Damage Component (OLD FORMULA) ---
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);

    // --- 4. Calculate Final Damage Based on Skill Type ---
    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      activeEnemy.element,
    );

    let totalDamage = 0;
    let elementalMessage = "";

    if (skillElement === "none") {
      // 4a. BASIC ATTACK ("none") - SPLIT DAMAGE
      const finalElementalDamage = Math.floor(
        baseElementalDamage * elementalMultiplier,
      );
      totalDamage = physicalDamage + finalElementalDamage;

      if (finalElementalDamage > 0) {
        if (elementalMultiplier > 1.0) {
          elementalMessage = " It's super effective!";
        } else if (elementalMultiplier < 1.0) {
          elementalMessage = " It was resisted...";
        }
      }
      addLog(
        `${baseSpirit.name} used ${skill.name}! Dealt ${totalDamage} damage ` +
          `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
          elementalMessage,
      );
    } else {
      // 4b. ELEMENTAL SKILL - CONVERTED DAMAGE
      const totalBaseDamage = physicalDamage + baseElementalDamage;
      totalDamage = Math.max(
        1,
        Math.floor(totalBaseDamage * elementalMultiplier),
      );

      if (elementalMultiplier > 1.0) {
        elementalMessage = " It's super effective!";
      } else if (elementalMultiplier < 1.0) {
        elementalMessage = " It was resisted...";
      }
      addLog(
        `${baseSpirit.name} used ${skill.name}! It's an ${attackElement.toUpperCase()} attack! ` +
          `Dealt ${totalDamage} total damage.` +
          elementalMessage,
      );
    }

    // --- 5. Apply Damage and Handle Healing/Victory ---
    const newEnemyHealth = Math.max(0, activeEnemy.currentHealth - totalDamage);

    playDamage();
    setEnemyHealthBarShake(true);
    setTimeout(() => setEnemyHealthBarShake(false), 500);

    // --- REFACTORED HEALING BLOCK ---
    let totalHealing = 0;
    if (skill.healing > 0) {
      const skillHealing = Math.floor(totalDamage * skill.healing);
      if (skillHealing > 0) {
        totalHealing += skillHealing;
        addLog(`${baseSpirit.name}'s ${skill.name} healed ${skillHealing} HP!`);
      }
    }
    if (baseSpirit.passiveAbilities && totalDamage > 0) {
      for (const passiveId of baseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[
          passiveId
        ];
        if (!passive || !passive.effects) continue;
        for (const effect of passive.effects) {
          if (
            effect.type === "elemental_lifesteal" &&
            effect.element === attackElement
          ) {
            const lifestealHealing = Math.floor(
              totalDamage * (effect as PassiveElementalLifesteal).ratio,
            );
            if (lifestealHealing > 0) {
              totalHealing += lifestealHealing;
              addLog(
                `${baseSpirit.name}'s "${passive.name}" passive healed ${lifestealHealing} HP!`,
              );
            }
          }
        }
      }
    }
    if (totalHealing > 0) {
      const newHealth = Math.min(
        activeSpirit.maxHealth,
        activeSpirit.currentHealth + totalHealing,
      );
      setPlayerSpirits((prev) =>
        prev.map((s, i) =>
          i === activePartySlot ? { ...s, currentHealth: newHealth } : s,
        ),
      );
      playHeal();
      setPlayerHealthBarHeal(true);
      setTimeout(() => setPlayerHealthBarHeal(false), 600);
    }
    // --- 6. HANDLE SKILL EFFECTS (like charging) ---
    if (skill.effects && skill.effects.length > 0) {
      if (!activeSpirit || !activeStats || !baseSpirit) return; // Safety check

      for (const skillEffect of skill.effects) {
        if (skillEffect.type === "charge") {
          // This is a charge move!
          const newActiveEffect: ActiveEffect = {
            id: `charge_${Date.now()}`,
            effectType: "charge",
            turnsRemaining: skillEffect.duration,
            // Copy all relevant data from the skill
            damageMultiplier: skillEffect.damageMultiplier,
            healingFlat: skillEffect.healingFlat,
            healingAffinityRatio: skillEffect.healingAffinityRatio,
            element: skillEffect.element,
            // Store caster's stats and target
            casterStats: {
              attack: activeStats.attack,
              affinity: activeStats.elementalAffinity,
              level: activeSpirit.playerSpirit.level,
            },
            targetIndex: activeEnemyIndex, // Store which enemy to hit
          };

          // Apply the charging effect to the caster (the active spirit)
          setPlayerSpirits((prev) =>
            prev.map((spirit, i) =>
              i === activePartySlot
                ? (applyStatusEffect(spirit, newActiveEffect) as BattleSpirit)
                : spirit,
            ),
          );
          addLog(`${baseSpirit.name} is gathering power!`);
        }
      }
    }

    // Set new enemy health and check for victory
    setBattleEnemies((prevEnemies) => {
      // Check for "on_get_hit" triggers on the enemy
      const { reflectedDamage, attackerEffects } = executeTriggerEffects(
        "on_get_hit",
        activeSpirit, // Attacker is player
        activeEnemy, // Target is enemy
        totalDamage,
      );

      // Apply any effects (like Poison) to the attacker (player)
      if (attackerEffects.length > 0) {
        setPlayerSpirits((prev) =>
          prev.map((spirit, i) => {
            let newSpirit = spirit;
            if (i === activePartySlot) {
              attackerEffects.forEach((eff) => {
                newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
              });
            }
            return newSpirit;
          }),
        );
      }
      // TODO: Handle reflectedDamage
      return prevEnemies.map((en, index) =>
        index === activeEnemyIndex
          ? { ...en, currentHealth: newEnemyHealth }
          : en,
      );
    });

    // Check for VICTORY or NEXT ENEMY
    if (newEnemyHealth <= 0) {
      addLog(`${activeEnemy.name} has been defeated!`);
      const hasMoreEnemies = activeEnemyIndex < battleEnemies.length - 1;
      if (hasMoreEnemies) {
        setTimeout(() => {
          setActiveEnemyIndex((prevIndex) => prevIndex + 1);
          const nextEnemy = battleEnemies[activeEnemyIndex + 1];
          addLog(`A new enemy appears: ${nextEnemy.name}!`);
        }, 1000);
        return;
      } else {
        setTimeout(() => {
          handleVictory(activeEnemy);
        }, 500);
        return;
      }
    }

    setTimeout(() => enemyTurn(), 800);
  };

  // --- FIX: Use `function` for hoisting ---
  function enemyTurn(specifiedTargetIndex?: number) {
    if (!activeEnemy || playerSpirits.length === 0) return;

    if (isBossBattle && bossState.atkBuffTurnsRemaining > 0) {
      const newBuffTurns = bossState.atkBuffTurnsRemaining - 1;
      setBossState((prev) => ({
        ...prev,
        atkBuffTurnsRemaining: newBuffTurns,
      }));

      if (newBuffTurns === 0 && activeEnemy.baseAttack) {
        setBattleEnemies((prev) =>
          prev.map((enemy, index) =>
            index === activeEnemyIndex
              ? { ...enemy, attack: activeEnemy.baseAttack! }
              : enemy,
          ),
        );
        addLog(`${activeEnemy.name}'s ATK Buff has worn off!`);
      }
    }

    let targetIndex =
      specifiedTargetIndex !== undefined
        ? specifiedTargetIndex
        : activePartySlot;
    while (
      targetIndex < playerSpirits.length &&
      playerSpirits[targetIndex].currentHealth <= 0
    ) {
      targetIndex++;
    }

    if (targetIndex >= playerSpirits.length) {
      setBattleState("defeat");
      addLog("All spirits have been defeated...");
      healAllSpirits();
      setPlayerSpirits((prev) =>
        prev.map((spirit) => ({
          ...spirit,
          currentHealth: spirit.maxHealth,
        })),
      );
      return;
    }

    const target = playerSpirits[targetIndex];
    if (!target) return; // Safety check
    const stats = calculateAllStats(target.playerSpirit);

    if (isBossBattle) {
      executeBossTurn(targetIndex, target, stats);
    } else {
      executeNormalEnemyTurn(targetIndex, target, stats);
    }
  }

  // --- FIX: Use `function` for hoisting ---
  function executeBossTurn(
    targetIndex: number,
    target: BattleSpirit,
    stats: any,
  ) {
    if (!activeEnemy) return;

    // --- NEW FORMULA SETUP ---
    const level = activeEnemy.level;
    const attack = activeEnemy.attack;
    const defense = Math.max(1, stats.defense);
    const STATIC_BASE_POWER = 60;
    const GAME_SCALING_FACTOR = 50;
    const levelComponent = Math.floor((2 * level) / 5) + 2;
    const attackDefenseRatio = attack / defense;
    const baseCalculation =
      Math.floor(
        (levelComponent * STATIC_BASE_POWER * attackDefenseRatio) /
          GAME_SCALING_FACTOR,
      ) + 2;
    // --- END OF NEW FORMULA SETUP ---

    const pattern = bossState.patternStep;

    if (pattern === 0) {
      // Basic Attack
      let damage = Math.max(1, Math.floor(baseCalculation * 1.0));

      if (isBlocking) {
        damage = Math.floor(damage * 0.5);
        addLog(
          `${getBaseSpirit(target.playerSpirit.spiritId)?.name} blocked! Damage reduced.`,
        );
        setIsBlocking(false);
      }

      let shieldBlocked = false;
      const hasShield = target.activeEffects.some(
        (effect) =>
          effect.effectType === "one_time_shield" && effect.blocksFullHit,
      );

      if (hasShield) {
        damage = 0;
        shieldBlocked = true;
        const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
        addLog(`${targetBase?.name}'s Shield blocks the attack!`);
      }

      const newHealth = Math.max(0, target.currentHealth - damage);

      const { reflectedDamage, attackerEffects } = executeTriggerEffects(
        "on_get_hit",
        activeEnemy, // Attacker is enemy
        target, // Target is player
        damage,
      );
      const newEnemyHealth =
        reflectedDamage > 0
          ? Math.max(0, activeEnemy.currentHealth - reflectedDamage)
          : activeEnemy.currentHealth;

      playDamage();
      setPlayerHealthBarShake(true);
      setTimeout(() => setPlayerHealthBarShake(false), 500);

      setPlayerSpirits((prev) => {
        const withDamage = prev.map((s, i) =>
          i === targetIndex
            ? {
                ...s,
                currentHealth: newHealth,
                activeEffects:
                  shieldBlocked && i === targetIndex
                    ? s.activeEffects.filter(
                        (e) =>
                          !(
                            e.effectType === "one_time_shield" &&
                            e.blocksFullHit
                          ),
                      )
                    : s.activeEffects,
              }
            : s,
        );

        // --- FIX: Stale state bug fix ---
        let spiritsToReturn = withDamage;
        setBattleEnemies((currentEnemies) => {
          const { updatedSpirits, updatedEnemies } = tickEffects(
            withDamage,
            currentEnemies,
          );
          spiritsToReturn = updatedSpirits;
          return updatedEnemies;
        });

        const updatedTarget = spiritsToReturn[targetIndex];
        if (updatedTarget && updatedTarget.currentHealth <= 0) {
          setTimeout(
            () => checkDefeat(updatedTarget.currentHealth, targetIndex),
            0,
          );
        }
        return spiritsToReturn;
        // --- END FIX ---
      });

      if (reflectedDamage > 0 || attackerEffects.length > 0) {
        setBattleEnemies((prevEnemies) =>
          prevEnemies.map((enemy, index) => {
            if (index !== activeEnemyIndex) return enemy;
            let newEnemy = { ...enemy };
            if (reflectedDamage > 0) {
              newEnemy.currentHealth = newEnemyHealth;
            }
            if (attackerEffects.length > 0) {
              attackerEffects.forEach((eff) => {
                newEnemy = applyStatusEffect(newEnemy, eff) as Enemy;
              });
            }
            return newEnemy;
          }),
        );

        if (reflectedDamage > 0 && newEnemyHealth <= 0) {
          addLog(`${activeEnemy.name} was defeated by Thorns!`);
          const hasMoreEnemies = activeEnemyIndex < battleEnemies.length - 1;
          if (hasMoreEnemies) {
            setTimeout(() => {
              const nextEnemyIndex = activeEnemyIndex + 1;
              setActiveEnemyIndex(nextEnemyIndex);
              const nextEnemy = battleEnemies[nextEnemyIndex];
              addLog(`A new enemy appears: ${nextEnemy.name}!`);
            }, 1000);
          } else {
            setTimeout(() => {
              handleVictory(activeEnemy);
            }, 500);
          }
          return;
        }
      }

      const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
      if (!shieldBlocked) {
        addLog(
          `${activeEnemy.name} uses Basic Strike on ${targetBase?.name}! Dealt ${damage} damage.`,
        );
      }

      setBossState((prev) => ({ ...prev, patternStep: 1 }));
      checkDefeat(newHealth, targetIndex);
    } else if (pattern === 1) {
      // ATK Buff
      const baseAttack = activeEnemy.baseAttack || activeEnemy.attack;
      const buffedAttack = Math.floor(baseAttack * 1.5);
      setBattleEnemies((prev) =>
        prev.map((enemy, index) =>
          index === activeEnemyIndex
            ? { ...enemy, attack: buffedAttack }
            : enemy,
        ),
      );
      setBossState((prev) => ({
        ...prev,
        patternStep: 2,
        atkBuffTurnsRemaining: 3,
      }));
      addLog(
        `${activeEnemy.name} uses ATK Buff! Attack increased for 3 turns!`,
      );
    } else if (pattern === 2) {
      // Charged Hit
      if (!bossState.isCharging) {
        setBossState((prev) => ({ ...prev, isCharging: true }));
        addLog(`${activeEnemy.name} is charging a powerful attack...`);
      } else {
        let damage = Math.max(1, Math.floor(baseCalculation * 2.0));

        if (isBlocking) {
          damage = Math.floor(damage * 0.5);
          addLog(
            `${getBaseSpirit(target.playerSpirit.spiritId)?.name} blocked! Damage reduced.`,
          );
          setIsBlocking(false);
        }

        let shieldBlocked = false;
        const hasShield = target.activeEffects.some(
          (effect) =>
            effect.effectType === "one_time_shield" && effect.blocksFullHit,
        );

        if (hasShield) {
          damage = 0;
          shieldBlocked = true;
          const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
          addLog(`${targetBase?.name}'s Shield blocks the attack!`);
        }

        const newHealth = Math.max(0, target.currentHealth - damage);

        const { reflectedDamage, attackerEffects } = executeTriggerEffects(
          "on_get_hit",
          activeEnemy,
          target,
          damage,
        );
        const newEnemyHealth =
          reflectedDamage > 0
            ? Math.max(0, activeEnemy.currentHealth - reflectedDamage)
            : activeEnemy.currentHealth;

        playDamage();
        setPlayerHealthBarShake(true);
        setTimeout(() => setPlayerHealthBarShake(false), 500);

        setPlayerSpirits((prev) => {
          const withDamage = prev.map((s, i) =>
            i === targetIndex
              ? {
                  ...s,
                  currentHealth: newHealth,
                  activeEffects:
                    shieldBlocked && i === targetIndex
                      ? s.activeEffects.filter(
                          (e) =>
                            !(
                              e.effectType === "one_time_shield" &&
                              e.blocksFullHit
                            ),
                        )
                      : s.activeEffects,
                }
              : s,
          );

          // --- FIX: Stale state bug fix ---
          let spiritsToReturn = withDamage;
          setBattleEnemies((currentEnemies) => {
            const { updatedSpirits, updatedEnemies } = tickEffects(
              withDamage,
              currentEnemies,
            );
            spiritsToReturn = updatedSpirits;
            return updatedEnemies;
          });

          const updatedTarget = spiritsToReturn[targetIndex];
          if (updatedTarget && updatedTarget.currentHealth <= 0) {
            setTimeout(
              () => checkDefeat(updatedTarget.currentHealth, targetIndex),
              0,
            );
          }
          return spiritsToReturn;
          // --- END FIX ---
        });

        if (reflectedDamage > 0 || attackerEffects.length > 0) {
          setBattleEnemies((prevEnemies) =>
            prevEnemies.map((enemy, index) => {
              if (index !== activeEnemyIndex) return enemy;
              let newEnemy = { ...enemy };
              if (reflectedDamage > 0) {
                newEnemy.currentHealth = newEnemyHealth;
              }
              if (attackerEffects.length > 0) {
                attackerEffects.forEach((eff) => {
                  newEnemy = applyStatusEffect(newEnemy, eff) as Enemy;
                });
              }
              return newEnemy;
            }),
          );

          if (reflectedDamage > 0 && newEnemyHealth <= 0) {
            addLog(`${activeEnemy.name} was defeated by Thorns!`);
            const hasMoreEnemies = activeEnemyIndex < battleEnemies.length - 1;
            if (hasMoreEnemies) {
              setTimeout(() => {
                const nextEnemyIndex = activeEnemyIndex + 1;
                setActiveEnemyIndex(nextEnemyIndex);
                const nextEnemy = battleEnemies[nextEnemyIndex];
                addLog(`A new enemy appears: ${nextEnemy.name}!`);
              }, 1000);
            } else {
              setTimeout(() => {
                handleVictory(activeEnemy);
              }, 500);
            }
            return;
          }
        }

        const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
        if (!shieldBlocked) {
          addLog(
            `${activeEnemy.name} unleashes Charged Hit on ${targetBase?.name}! Dealt ${damage} devastating damage!`,
          );
        }

        setBossState((prev) => ({
          ...prev,
          patternStep: 0,
          isCharging: false,
        }));
        checkDefeat(newHealth, targetIndex);
      }
    }
  }

  // --- FIX: Use `function` for hoisting ---
  function executeNormalEnemyTurn(
    targetIndex: number,
    target: BattleSpirit,
    stats: any,
  ) {
    if (!activeEnemy) {
      addLog("Error: Enemy turn failed (no enemy).");
      return;
    }
    if (!currentEncounter || currentEncounter.enemies.length === 0) {
      addLog(`${activeEnemy.name} uses a simple attack!`);
      const damage = Math.max(1, activeEnemy.attack - stats.defense);
      const newHealth = Math.max(0, target.currentHealth - damage);
      setPlayerSpirits((prev) =>
        prev.map((s, i) =>
          i === targetIndex ? { ...s, currentHealth: newHealth } : s,
        ),
      );
      addLog(`Dealt ${damage} damage.`);
      checkDefeat(newHealth, targetIndex);
      return;
    }

    const enemyData = currentEncounter.enemies[activeEnemyIndex];
    if (!enemyData) {
      addLog("Error: Could not find enemy data for AI.");
      return;
    }
    const aiStep = bossState.patternStep;
    let skillId = enemyData.ai[aiStep % enemyData.ai.length];

    if (skillId === "r000") {
      const mockEnemyPlayerSpirit: PlayerSpirit = {
        instanceId: activeEnemy.id,
        spiritId: enemyData.spiritId,
        level: activeEnemy.level,
        experience: 0,
        isPrismatic: false,
        potentialFactors: {
          attack: "C",
          defense: "C",
          health: "C",
          elementalAffinity: "C",
        },
      };

      const enemySkills = getAvailableSkills(mockEnemyPlayerSpirit);
      if (!enemySkills || enemySkills.length === 0) {
        addLog(
          `Error: Could not find skills for ${activeEnemy.name}. Defaulting to basic attack.`,
        );
        skillId = "basic_attack";
      } else {
        const validSkills = enemySkills.filter(Boolean);
        let usableSkills = validSkills.filter(
          (skill) => skill.id !== "basic_attack",
        );
        if (usableSkills.length === 0) {
          usableSkills = validSkills.filter(
            (skill) => skill.id === "basic_attack",
          );
        }
        if (usableSkills.length === 0) {
          addLog(
            `${activeEnemy.name} knows no valid moves! Defaulting to basic attack.`,
          );
          skillId = "basic_attack";
        } else {
          const randomSkill =
            usableSkills[Math.floor(Math.random() * usableSkills.length)];
          skillId = randomSkill.id;
          addLog(`${activeEnemy.name} is unpredictable!`);
        }
      }
    }

    const skill = getSkill(skillId);
    if (!skill) {
      addLog(
        `Error: Enemy AI skill "${skillId}" not found. Defaulting to basic attack.`,
      );
      skillId = "basic_attack";
    }
    const finalSkill = getSkill(skillId)!;

    const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
    const spiritElement: ElementId = activeEnemy.element;
    const affinityStat = activeEnemy.elementalAffinity;
    const skillElement = finalSkill.element;
    let affinityRatio =
      skillElement === "none" || skillElement === spiritElement ? 0.25 : 0.15;
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    const level = activeEnemy.level;
    const attack = activeEnemy.attack;
    const defense = Math.max(1, stats.defense);
    const STATIC_BASE_POWER = 60;
    const GAME_SCALING_FACTOR = 50;
    const levelComponent = Math.floor((2 * level) / 5) + 2;
    const attackDefenseRatio = attack / defense;
    const baseCalculation =
      Math.floor(
        (levelComponent * STATIC_BASE_POWER * attackDefenseRatio) /
          GAME_SCALING_FACTOR,
      ) + 2;

    // --- FIX: Allow 0 damage for non-damage skills ---
    const physicalDamage = Math.floor(baseCalculation * finalSkill.damage);
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);
    // --- END FIX ---

    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      targetBase?.element || "none",
    );

    let totalDamage = 0;
    let elementalMessage = "";

    if (skillElement === "none") {
      const finalElementalDamage = Math.floor(
        baseElementalDamage * elementalMultiplier,
      );
      totalDamage = physicalDamage + finalElementalDamage;

      // --- FIX: Ensure 1 damage if skill is supposed to do damage ---
      if (finalSkill.damage > 0 && totalDamage < 1) {
        totalDamage = 1;
      }
      // --- END FIX ---

      if (finalElementalDamage > 0) {
        if (elementalMultiplier > 1.0)
          elementalMessage = " It's super effective!";
        else if (elementalMultiplier < 1.0)
          elementalMessage = " It was resisted...";
      }
      addLog(
        `${activeEnemy.name} used ${finalSkill.name}! Dealt ${totalDamage} damage ` +
          `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
          elementalMessage,
      );
    } else {
      const totalBaseDamage = physicalDamage + baseElementalDamage;
      totalDamage = Math.floor(totalBaseDamage * elementalMultiplier);

      // --- FIX: Ensure 1 damage if skill is supposed to do damage ---
      if (finalSkill.damage > 0 && totalDamage < 1) {
        totalDamage = 1;
      }
      // --- END FIX ---

      if (elementalMultiplier > 1.0)
        elementalMessage = " It's super effective!";
      else if (elementalMultiplier < 1.0)
        elementalMessage = " It was resisted...";
      addLog(
        `${activeEnemy.name} used ${finalSkill.name}! It's an ${attackElement.toUpperCase()} attack! ` +
          `Dealt ${totalDamage} total damage.` +
          elementalMessage,
      );
    }

    // --- FIX: Handle enemy skill effects (like charging "Ancestral Healing") ---
    if (finalSkill.effects && finalSkill.effects.length > 0) {
      if (!activeEnemy) return; // Safety check

      for (const skillEffect of finalSkill.effects) {
        if (skillEffect.type === "charge") {
          // This is a charge move!
          const newActiveEffect: ActiveEffect = {
            id: `charge_${Date.now()}`,
            effectType: "charge",
            turnsRemaining: skillEffect.duration,
            // Copy all relevant data from the skill
            damageMultiplier: skillEffect.damageMultiplier,
            healingFlat: skillEffect.healingFlat,
            healingAffinityRatio: skillEffect.healingAffinityRatio,
            element: skillEffect.element,
            // Store caster's stats and target
            casterStats: {
              attack: activeEnemy.attack,
              affinity: activeEnemy.elementalAffinity,
              level: activeEnemy.level,
            },
            targetIndex: targetIndex, // Store which player to hit (or self to heal)
          };

          // Apply the charging effect to the caster (the active enemy)
          setBattleEnemies((prev) =>
            prev.map((enemy, i) =>
              i === activeEnemyIndex
                ? (applyStatusEffect(enemy, newActiveEffect) as Enemy)
                : enemy,
            ),
          );
          addLog(`${activeEnemy.name} is gathering power!`);
        }
      }
    }
    // --- END FIX ---

    let damage = totalDamage;
    if (isBlocking) {
      damage = Math.floor(damage * 0.5);
      addLog(`${targetBase?.name} blocked! Damage reduced.`);
      setIsBlocking(false);
    }

    let shieldBlocked = false;
    const hasShield = target.activeEffects.some(
      (effect) =>
        effect.effectType === "one_time_shield" && effect.blocksFullHit,
    );

    if (hasShield) {
      damage = 0;
      shieldBlocked = true;
      addLog(`${targetBase?.name}'s Shield blocks the attack!`);
    }

    const newHealth = Math.max(0, target.currentHealth - damage);

    const { reflectedDamage, attackerEffects } = executeTriggerEffects(
      "on_get_hit",
      activeEnemy,
      target,
      damage,
    );
    const newEnemyHealth =
      reflectedDamage > 0
        ? Math.max(0, activeEnemy.currentHealth - reflectedDamage)
        : activeEnemy.currentHealth;

    if (damage > 0) {
      playDamage();
      setPlayerHealthBarShake(true);
      setTimeout(() => setPlayerHealthBarShake(false), 500);
    }

    setPlayerSpirits((prev) => {
      const withDamage = prev.map((s, i) =>
        i === targetIndex
          ? {
              ...s,
              currentHealth: newHealth,
              activeEffects: shieldBlocked
                ? s.activeEffects.filter(
                    (e) =>
                      !(e.effectType === "one_time_shield" && e.blocksFullHit),
                  )
                : s.activeEffects,
            }
          : s,
      );

      // --- FIX: Stale state bug fix ---
      let spiritsToReturn = withDamage;
      setBattleEnemies((currentEnemies) => {
        const { updatedSpirits, updatedEnemies } = tickEffects(
          withDamage,
          currentEnemies,
        );
        // --- THIS WAS THE TYPO ---
        spiritsToReturn = updatedSpirits;
        // --- END TYPO FIX ---
        return updatedEnemies;
      });

      const updatedTarget = spiritsToReturn[targetIndex];
      if (updatedTarget && updatedTarget.currentHealth <= 0) {
        setTimeout(
          () => checkDefeat(updatedTarget.currentHealth, targetIndex),
          0,
        );
      }
      return spiritsToReturn;
      // --- END FIX ---
    });

    if (reflectedDamage > 0 || attackerEffects.length > 0) {
      setBattleEnemies((prevEnemies) =>
        prevEnemies.map((enemy, index) => {
          if (index !== activeEnemyIndex) return enemy;
          let newEnemy = { ...enemy };
          if (reflectedDamage > 0) {
            newEnemy.currentHealth = newEnemyHealth;
          }
          if (attackerEffects.length > 0) {
            attackerEffects.forEach((eff) => {
              newEnemy = applyStatusEffect(newEnemy, eff) as Enemy;
            });
          }
          return newEnemy;
        }),
      );

      if (reflectedDamage > 0 && newEnemyHealth <= 0) {
        addLog(`${activeEnemy.name} was defeated by Thorns!`);
        const hasMoreEnemies = activeEnemyIndex < battleEnemies.length - 1;
        if (hasMoreEnemies) {
          setTimeout(() => {
            const nextEnemyIndex = activeEnemyIndex + 1;
            setActiveEnemyIndex(nextEnemyIndex);
            const nextEnemy = battleEnemies[nextEnemyIndex];
            addLog(`A new enemy appears: ${nextEnemy.name}!`);
          }, 1000);
        } else {
          setTimeout(() => {
            handleVictory(activeEnemy);
          }, 500);
        }
        return;
      }
    }

    setBossState((prev) => ({ ...prev, patternStep: prev.patternStep + 1 }));
    checkDefeat(newHealth, targetIndex);
  }

  const checkDefeat = (newHealth: number, targetIndex: number) => {
    if (newHealth <= 0) {
      const targetBase = getBaseSpirit(
        playerSpirits[targetIndex].playerSpirit.spiritId,
      );
      addLog(`${targetBase?.name} has been defeated!`);

      const hasLivingSpirit = playerSpirits.some(
        (s, i) => i !== targetIndex && s.currentHealth > 0,
      );

      if (!hasLivingSpirit) {
        setTimeout(() => {
          setBattleState("defeat");
          addLog("All spirits have been defeated...");
          healAllSpirits();
          setPlayerSpirits((prev) =>
            prev.map((spirit) => ({
              ...spirit,
              currentHealth: spirit.maxHealth,
            })),
          );
        }, 800);
      } else {
        setTimeout(() => {
          const nextAliveIndex = playerSpirits.findIndex(
            (s, i) => i !== targetIndex && s.currentHealth > 0,
          );
          if (nextAliveIndex !== -1) {
            const nextSpirit = getBaseSpirit(
              playerSpirits[nextAliveIndex].playerSpirit.spiritId,
            );
            setActivePartySlot(nextAliveIndex);
            addLog(`${nextSpirit?.name} enters the battle!`);
          }
        }, 800);
      }
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
    if (!baseSpirit) return;

    setIsBlocking(true);
    setActionMenu("none");
    addLog(`${baseSpirit.name} takes a defensive stance!`);

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
