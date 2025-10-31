import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  getElement,
  calculateAllStats,
  getAvailableSkills,
  getSkill,
  getRandomEnemy,
  getElementalDamageMultiplier,
} from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import {
  X,
  Swords,
  ArrowLeftRight,
  Heart,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion } from "framer-motion";
import type {
  PlayerSpirit,
  ActiveEffect,
  BaseSpirit,
  ElementId,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";

type ActionMenu = "none" | "skills" | "swap";

interface BattleScreenProps {
  onClose: () => void;
  isBossBattle?: boolean;
}

interface BattleSpirit {
  playerSpirit: PlayerSpirit;
  currentHealth: number;
  maxHealth: number;
  activeEffects: ActiveEffect[];
}

interface Enemy {
  id: string;
  name: string;
  level: number;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  baseAttack?: number;
  element: ElementId;
  elementalAffinity: number;
}

interface BossBattleState {
  patternStep: number;
  atkBuffTurnsRemaining: number;
  isCharging: boolean;
}

export function BattleScreen({
  onClose,
  isBossBattle = false,
}: BattleScreenProps) {
  const {
    spirits,
    activeParty,
    winBattle,
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
  const [battleState, setBattleState] = useState<
    "setup" | "fighting" | "victory" | "defeat"
  >("setup");
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [battleRewards, setBattleRewards] = useState<{
    qi: number;
    qiGeneration: number;
  } | null>(null);
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

  const generateBossEnemy = (): Enemy => {
    const bossSpirit = getBaseSpirit("boss_01");
    if (!bossSpirit) {
      return {
        id: "boss_" + Date.now(),
        name: "Heavenly Warlord",
        level: 10,
        attack: 300,
        defense: 150,
        maxHealth: 1500,
        currentHealth: 1500,
        baseAttack: 300,
        element: "fire",
        elementalAffinity: 50,
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
      name: bossSpirit.name,
      level,
      attack: stats.attack,
      defense: stats.defense,
      maxHealth: stats.health,
      currentHealth: stats.health,
      baseAttack: stats.attack,
      element: bossSpirit.element,
      elementalAffinity: stats.elementalAffinity,
    };
  };

  const generateNewEnemy = (spiritList: BattleSpirit[]) => {
    console.log("--- 1. Generating New Enemy ---");

    if (isBossBattle) {
      console.log("This is a boss battle, generating boss.");
      return generateBossEnemy();
    }

    if (spiritList.length === 0) {
      console.error("Generate enemy failed: Player spirit list is empty.");
      return null;
    }

    // --- This part is the same ---
    const highestLevel = Math.max(
      ...spiritList.map((s) => s.playerSpirit.level),
    );
    const levelOffset = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, or 2
    const enemyLevel = Math.max(1, highestLevel + levelOffset);
    console.log(
      `--- 2. Target enemy level: ${enemyLevel} (base level ${highestLevel}) ---`,
    );

    // --- THIS SECTION IS UPDATED ---

    // 1. Get spirit data from JSON
    const spiritMap = (spiritsData as any).default || spiritsData;

    // CHANGED: Get all the arrays (common, uncommon, etc.)
    const allSpiritArrays: BaseSpirit[][] = Object.values(spiritMap);
    // CHANGED: Flatten the array of arrays into a single array of spirits
    const allSpirits: BaseSpirit[] = allSpiritArrays.flat();

    console.log(
      `--- 3. Loaded ${allSpirits.length} total spirits from JSON ---`,
    ); // This should now log 46

    // 2. Filter for valid spirits that ACTUALLY HAVE baseStats
    const validSpirits = allSpirits.filter((spirit) => spirit.baseStats);
    console.log(
      `--- 4. Found ${validSpirits.length} spirits with a 'baseStats' property ---`,
    ); // This should also log 46

    // 3. If no spirits have baseStats at all, log an error and exit
    if (validSpirits.length === 0) {
      console.error(
        "CRITICAL ERROR: No spirits in spirits.json have a 'baseStats' property. Cannot generate enemy.",
        spiritMap,
      );
      return null; // No valid spirits to generate
    }

    // 4. Filter valid spirits by rarity
    const allowedRarities = ["common", "uncommon", "rare"];
    let eligibleSpirits = validSpirits.filter((spirit) =>
      allowedRarities.includes(spirit.rarity),
    );
    console.log(
      `--- 5. Found ${eligibleSpirits.length} spirits matching allowed rarities (common, uncommon, rare) ---`,
    ); // This should log "40"

    // 5. Fallback: If no spirits match rarity, use ANY valid spirit
    if (eligibleSpirits.length === 0) {
      console.log(
        "--- 6. No spirits matched rarity, falling back to all valid spirits. ---",
      );
      eligibleSpirits = validSpirits;
    }
    // --- END OF UPDATED SECTION ---

    const randomSpirit =
      eligibleSpirits[Math.floor(Math.random() * eligibleSpirits.length)];

    console.log(
      "--- 7. Selected random spirit:",
      randomSpirit.name,
      randomSpirit,
    );

    const enemyPotentialBonus = 0.02; // The 2% bonus instead of a real potential factor
    const levelMultiplier = enemyLevel * 0.02;

    // 6. Apply the new player-like formula to the enemy stats
    // This block should now be safe
    const enemyAttack = Math.floor(
      randomSpirit.baseStats.attack *
        (1 + enemyPotentialBonus) *
        levelMultiplier,
    );
    const enemyDefense = Math.floor(
      randomSpirit.baseStats.defense *
        (1 + enemyPotentialBonus) *
        levelMultiplier,
    );
    const enemyHealth =
      Math.floor(
        randomSpirit.baseStats.health *
          (1 + enemyPotentialBonus) *
          levelMultiplier,
      ) + 10;
    const enemyElementalAffinity = Math.floor(
      randomSpirit.baseStats.elementalAffinity *
        (1 + enemyPotentialBonus) *
        levelMultiplier,
    );

    const newEnemy: Enemy = {
      id: "enemy_" + Date.now(),
      name: randomSpirit.name, // Use spirit's name
      level: enemyLevel,
      attack: enemyAttack,
      defense: enemyDefense,
      maxHealth: enemyHealth,
      currentHealth: enemyHealth,
      element: randomSpirit.element, // Use spirit's element
      elementalAffinity: enemyElementalAffinity,
    };

    console.log("--- 8. Successfully generated new enemy:", newEnemy);
    return newEnemy;
  };

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
            spirit.currentHealth ?? stats.health, // Use saved HP or full HP
            stats.health, // But never let it be more than the max
          ),
          activeEffects: spirit.activeEffects || [],
        };
      });

    setPlayerSpirits(spiritsInBattle);

    const newEnemy = generateNewEnemy(spiritsInBattle);
    if (newEnemy) {
      setEnemy(newEnemy);
      setBattleLog([
        `A wild ${newEnemy.name} (Lv. ${newEnemy.level}) appears!`,
      ]);
    }
  }, [activeParty, spirits]);

  const startBattle = () => {
    if (playerSpirits.length === 0) return;
    setBattleState("fighting");
    setBattleRewards(null);
    addLog("Battle begins!");

    // Switch to battle music
    playBattleMusic();
  };

  const handleVictory = (targetEnemy: Enemy) => {
    setBattleState("victory");
    addLog("Victory! The enemy has been defeated!");

    // Calculate rewards based on enemy level and multiplier
    const baseQiReward = targetEnemy.level * 10;
    const qiReward = Math.floor(baseQiReward * battleRewardMultiplier);
    const qiGenerationIncrease = 0.1;
    setBattleRewards({ qi: qiReward, qiGeneration: qiGenerationIncrease });

    // Heal all spirits to full health in both local state and game state
    setPlayerSpirits((prev) =>
      prev.map((spirit) => ({
        ...spirit,
        currentHealth: spirit.maxHealth,
      })),
    );

    // Update game state with full health and battle rewards
    playerSpirits.forEach((spirit) => {
      // Recalculate full health to ensure state is correct before saving
      const stats = calculateAllStats(spirit.playerSpirit);
      updateSpiritHealth(spirit.playerSpirit.instanceId, stats.health);
    });
    winBattle(qiReward);
  };

  const addLog = (message: string) => {
    setBattleLog((prev) => [...prev, message]);
  };

  const executeTriggerEffects = (
    trigger: string,
    attacker: BattleSpirit | Enemy,
    target: BattleSpirit | Enemy | null,
    damage?: number,
  ): number => {
    let reflectedDamage = 0;

    // Handle Thorns effect on 'on_get_hit' trigger
    if (trigger === "on_get_hit" && target && "activeEffects" in target) {
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

    return reflectedDamage;
  };

  const applyStatusEffect = (
    spirit: BattleSpirit,
    effect: ActiveEffect,
  ): BattleSpirit => {
    // Phase 3: Implement status effect application logic
    // Check if effect stacks, refresh duration, or apply new
    return {
      ...spirit,
      activeEffects: [...spirit.activeEffects, effect],
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

  const handleAttack = (skillId: string) => {
    if (!enemy || battleState !== "fighting" || playerSpirits.length === 0)
      return;

    const activeSpirit = playerSpirits[activePartySlot];
    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;

    const skill = getSkill(skillId);
    const stats = calculateAllStats(activeSpirit.playerSpirit);
    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);

    if (!skill || !baseSpirit) return;

    // --- 1. Determine Elemental Properties and Affinity Ratio ---
    const spiritElement: ElementId = baseSpirit.element;
    const affinityStat = stats.elementalAffinity;
    const skillElement = skill.element;

    let affinityRatio = 0;
    if (skillElement === "none" || skillElement === spiritElement) {
      affinityRatio = 0.25; // Normal attack or matching element uses 0.25
    } else {
      affinityRatio = 0.15; // Mismatched element uses 0.15
    }
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // --- 2. Calculate Physical Damage Component ---
    // Physical Damage = max(1, floor(Spirit Attack * Skill Damage - Enemy Defense * 0.4))
    const basePhysicalDamage = stats.attack * skill.damage;
    const physicalDamage = Math.max(
      1,
      Math.floor(basePhysicalDamage - enemy.defense * 0.4),
    );

    // --- 3. Calculate Elemental Damage Component ---
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);
    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      enemy.element,
    );
    const finalElementalDamage = Math.floor(
      baseElementalDamage * elementalMultiplier,
    );
    let elementalMessage = "";
    if (finalElementalDamage > 0) {
      // Only show if elemental damage was dealt
      if (elementalMultiplier > 1.0) {
        elementalMessage = " It's super effective!";
      } else if (elementalMultiplier < 1.0) {
        elementalMessage = " It was resisted...";
      }
    }

    // --- 4. Calculate Total Damage ---
    const totalDamage = physicalDamage + finalElementalDamage;
    const newEnemyHealth = Math.max(0, enemy.currentHealth - totalDamage);

    // Play damage sound and shake enemy health bar
    playDamage();
    setEnemyHealthBarShake(true);
    setTimeout(() => setEnemyHealthBarShake(false), 500);

    // --- 5. Update Battle Log with Breakdown ---
    addLog(
      `${baseSpirit.name} used ${skill.name}! Dealt ${totalDamage} damage ` +
        `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
        elementalMessage,
    );

    if (skill.healing > 0) {
      const healing = Math.floor(totalDamage * skill.healing); // Use totalDamage for healing
      const newHealth = Math.min(
        activeSpirit.maxHealth,
        activeSpirit.currentHealth + healing,
      );
      setPlayerSpirits((prev) =>
        prev.map((s, i) =>
          i === activePartySlot ? { ...s, currentHealth: newHealth } : s,
        ),
      );

      // Play heal sound and glow player health bar
      playHeal();
      setPlayerHealthBarHeal(true);
      setTimeout(() => setPlayerHealthBarHeal(false), 600);

      addLog(`${baseSpirit.name} healed ${healing} HP!`);
    }

    setEnemy({ ...enemy, currentHealth: newEnemyHealth });

    if (newEnemyHealth <= 0) {
      setTimeout(() => {
        handleVictory(enemy);
      }, 500);
      return;
    }

    setTimeout(() => enemyTurn(), 800);
  };

  const enemyTurn = (specifiedTargetIndex?: number) => {
    if (!enemy || playerSpirits.length === 0) return;

    // Decrease ATK buff turns if active and reset attack when it expires
    if (isBossBattle && bossState.atkBuffTurnsRemaining > 0) {
      const newBuffTurns = bossState.atkBuffTurnsRemaining - 1;
      setBossState((prev) => ({
        ...prev,
        atkBuffTurnsRemaining: newBuffTurns,
      }));

      // Reset attack to base when buff expires
      if (newBuffTurns === 0 && enemy.baseAttack) {
        setEnemy((prev) =>
          prev ? { ...prev, attack: enemy.baseAttack! } : null,
        );
        addLog(`${enemy.name}'s ATK Buff has worn off!`);
      }
    }

    // Use the specified target index if provided, otherwise use activePartySlot
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

      // Heal all spirits when losing (both global and local state)
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
    const stats = calculateAllStats(target.playerSpirit);

    if (isBossBattle) {
      executeBossTurn(targetIndex, target, stats);
    } else {
      executeNormalEnemyTurn(targetIndex, target, stats);
    }
  };

  const executeBossTurn = (
    targetIndex: number,
    target: BattleSpirit,
    stats: any,
  ) => {
    if (!enemy) return;

    // Boss attack pattern: 0 = Basic Attack, 1 = ATK Buff, 2 = Charged Hit
    const pattern = bossState.patternStep;

    if (pattern === 0) {
      // Basic Attack
      let damage = Math.max(1, Math.floor(enemy.attack - stats.defense * 0.3));

      if (isBlocking) {
        damage = Math.floor(damage * 0.5);
        addLog(
          `${getBaseSpirit(target.playerSpirit.spiritId)?.name} blocked! Damage reduced.`,
        );
        setIsBlocking(false);
      }

      // Check for Shield effects
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

      // Calculate Thorns reflected damage
      const reflectedDamage = executeTriggerEffects(
        "on_get_hit",
        enemy,
        target,
        damage,
      );
      const newEnemyHealth =
        reflectedDamage > 0
          ? Math.max(0, enemy.currentHealth - reflectedDamage)
          : enemy.currentHealth;

      playDamage();
      setPlayerHealthBarShake(true);
      setTimeout(() => setPlayerHealthBarShake(false), 500);

      setPlayerSpirits((prev) => {
        // Apply damage first
        const withDamage = prev.map((s, i) =>
          i === targetIndex
            ? {
                ...s,
                currentHealth: newHealth,
                // Remove Shield effect if it blocked damage
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
        // Then tick effects
        const { updatedSpirits } = tickEffects(withDamage, enemy);

        // Check for defeat after DOT effects
        const updatedTarget = updatedSpirits[targetIndex];
        if (updatedTarget && updatedTarget.currentHealth <= 0) {
          setTimeout(
            () => checkDefeat(updatedTarget.currentHealth, targetIndex),
            0,
          );
        }

        return updatedSpirits;
      });

      // Update enemy health if Thorns reflected damage
      if (reflectedDamage > 0) {
        setEnemy({ ...enemy, currentHealth: newEnemyHealth });
        // Check if enemy was defeated by Thorns
        if (newEnemyHealth <= 0) {
          // This is the correct call to fix the error and trigger victory logic
          setTimeout(() => handleVictory(enemy), 0);
        }
      }

      const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
      if (!shieldBlocked) {
        addLog(
          `${enemy.name} uses Basic Strike on ${targetBase?.name}! Dealt ${damage} damage.`,
        );
      }

      setBossState((prev) => ({ ...prev, patternStep: 1 }));

      checkDefeat(newHealth, targetIndex);
    } else if (pattern === 1) {
      // ATK Buff
      const baseAttack = enemy.baseAttack || enemy.attack;
      const buffedAttack = Math.floor(baseAttack * 1.5);
      setEnemy({ ...enemy, attack: buffedAttack });
      setBossState((prev) => ({
        ...prev,
        patternStep: 2,
        atkBuffTurnsRemaining: 3,
      }));

      addLog(`${enemy.name} uses ATK Buff! Attack increased for 3 turns!`);
    } else if (pattern === 2) {
      // Charged Hit
      if (!bossState.isCharging) {
        // Start charging
        setBossState((prev) => ({ ...prev, isCharging: true }));
        addLog(`${enemy.name} is charging a powerful attack...`);
      } else {
        // Execute charged attack (2x damage)
        let damage = Math.max(
          1,
          Math.floor(enemy.attack * 2.0 - stats.defense * 0.3),
        );

        if (isBlocking) {
          damage = Math.floor(damage * 0.5);
          addLog(
            `${getBaseSpirit(target.playerSpirit.spiritId)?.name} blocked! Damage reduced.`,
          );
          setIsBlocking(false);
        }

        // Check for Shield effects
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

        // Calculate Thorns reflected damage
        const reflectedDamage = executeTriggerEffects(
          "on_get_hit",
          enemy,
          target,
          damage,
        );
        const newEnemyHealth =
          reflectedDamage > 0
            ? Math.max(0, enemy.currentHealth - reflectedDamage)
            : enemy.currentHealth;

        playDamage();
        setPlayerHealthBarShake(true);
        setTimeout(() => setPlayerHealthBarShake(false), 500);

        setPlayerSpirits((prev) => {
          // Apply damage first
          const withDamage = prev.map((s, i) =>
            i === targetIndex
              ? {
                  ...s,
                  currentHealth: newHealth,
                  // Remove Shield effect if it blocked damage
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
          // Then tick effects
          const { updatedSpirits } = tickEffects(withDamage, enemy);

          // Check for defeat after DOT effects
          const updatedTarget = updatedSpirits[targetIndex];
          if (updatedTarget && updatedTarget.currentHealth <= 0) {
            setTimeout(
              () => checkDefeat(updatedTarget.currentHealth, targetIndex),
              0,
            );
          }

          return updatedSpirits;
        });

        // Update enemy health if Thorns reflected damage
        if (reflectedDamage > 0) {
          setEnemy({ ...enemy, currentHealth: newEnemyHealth });
          // Check if enemy was defeated by Thorns
          if (newEnemyHealth <= 0) {
            // This is the correct call to fix the error and trigger victory logic
            setTimeout(() => handleVictory(enemy), 0);
          }
        }

        const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
        if (!shieldBlocked) {
          addLog(
            `${enemy.name} unleashes Charged Hit on ${targetBase?.name}! Dealt ${damage} devastating damage!`,
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
  };

  const executeNormalEnemyTurn = (
    targetIndex: number,
    target: BattleSpirit,
    stats: any,
  ) => {
    if (!enemy) return;

    // --- 1. SIMULATE A "BASIC ATTACK" SKILL ---
    const skillDamageMultiplier = 1.0; // Basic attack has 1.0 damage
    const skillElement = "none"; // "none" means it will use the spirit's main element

    // --- 2. DETERMINE ELEMENTAL PROPERTIES (Copied from player logic) ---
    const spiritElement: ElementId = enemy.element;
    const affinityStat = enemy.elementalAffinity; // Use the new stat

    let affinityRatio = 0;
    if (skillElement === "none" || skillElement === spiritElement) {
      affinityRatio = 0.25; // Normal attack or matching element
    } else {
      affinityRatio = 0.15; // Mismatched element (won't happen with "none")
    }
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // --- 3. CALCULATE PHYSICAL DAMAGE (Using enemy's defense formula) ---
    const basePhysicalDamage = enemy.attack * skillDamageMultiplier;
    const physicalDamage = Math.max(
      1,
      // Using the enemy's original defense reduction of 0.3
      Math.floor(basePhysicalDamage - stats.defense * 0.3),
    );

    // --- 4. CALCULATE ELEMENTAL DAMAGE (Copied from player logic) ---
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);
    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      activeBaseSpirit?.element || "none", // Get target's element
    );
    const finalElementalDamage = Math.floor(
      baseElementalDamage * elementalMultiplier,
    );
    let elementalMessage = "";
    if (finalElementalDamage > 0) {
      // Only show if elemental damage was dealt
      if (elementalMultiplier > 1.0) {
        elementalMessage = " It's super effective!";
      } else if (elementalMultiplier < 1.0) {
        elementalMessage = " It was resisted...";
      }
    }

    // --- 5. CALCULATE TOTAL DAMAGE ---
    let damage = physicalDamage + finalElementalDamage;

    // --- 6. (OLD LOGIC) APPLY BLOCK / SHIELD ---
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

    // --- 7. (OLD LOGIC) REFLECT, APPLY, AND LOG DAMAGE ---
    const reflectedDamage = executeTriggerEffects(
      "on_get_hit",
      enemy,
      target,
      damage,
    );
    const newEnemyHealth =
      reflectedDamage > 0
        ? Math.max(0, enemy.currentHealth - reflectedDamage)
        : enemy.currentHealth;

    playDamage();
    setPlayerHealthBarShake(true);
    setTimeout(() => setPlayerHealthBarShake(false), 500);

    // (This part remains the same: setPlayerSpirits, tickEffects, etc.)
    setPlayerSpirits((prev) => {
      // Apply damage first
      const withDamage = prev.map((s, i) =>
        i === targetIndex
          ? {
              ...s,
              currentHealth: newHealth,
              // Remove Shield effect if it blocked damage
              activeEffects:
                shieldBlocked && i === targetIndex
                  ? s.activeEffects.filter(
                      (e) =>
                        !(
                          e.effectType === "one_time_shield" && e.blocksFullHit
                        ),
                    )
                  : s.activeEffects,
            }
          : s,
      );
      // Then tick effects
      const { updatedSpirits } = tickEffects(withDamage, enemy);

      // Check for defeat after DOT effects
      const updatedTarget = updatedSpirits[targetIndex];
      if (updatedTarget && updatedTarget.currentHealth <= 0) {
        setTimeout(
          () => checkDefeat(updatedTarget.currentHealth, targetIndex),
          0,
        );
      }

      return updatedSpirits;
    });

    if (reflectedDamage > 0) {
      setEnemy({ ...enemy, currentHealth: newEnemyHealth });
      if (newEnemyHealth <= 0) {
        setTimeout(() => handleVictory(enemy), 0);
      }
    }

    const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
    if (!shieldBlocked) {
      // --- 8. UPDATE BATTLE LOG ---
      addLog(
        `${enemy.name} attacks ${targetBase?.name}! Dealt ${damage} damage ` +
          `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
          elementalMessage,
      );
    }

    checkDefeat(newHealth, targetIndex);
  };

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

          // Heal all spirits when losing (both global and local state)
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

    // Pass the new index directly to enemyTurn to ensure it targets the correct spirit
    setTimeout(() => enemyTurn(index), 800);
  };

  const handleBlock = () => {
    if (battleState !== "fighting") return;

    const activeSpirit = playerSpirits[activePartySlot];
    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;

    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);
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
    // Generate new enemy based on current player spirits
    const newEnemy = generateNewEnemy(playerSpirits);
    if (!newEnemy) return;

    setEnemy(newEnemy);
    setBattleState("fighting");
    setBattleRewards(null);
    setActivePartySlot(0);
    setActionMenu("none");
    setIsBlocking(false);
    addLog(`A wild ${newEnemy.name} (Lv. ${newEnemy.level}) appears!`);
    addLog("The battle continues!");
  };

  const handleClose = () => {
    // Only save health if not defeated (defeat heals all spirits)
    if (battleState !== "defeat") {
      playerSpirits.forEach((spirit) => {
        updateSpiritHealth(
          spirit.playerSpirit.instanceId,
          spirit.currentHealth,
        );
      });
    }

    // Switch back to explore music when leaving battle
    playExploreMusic();

    onClose();
  };

  if (activeParty.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
        <div className="parchment-bg chinese-border max-w-md w-full p-8 rounded-lg relative">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
            className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 parchment-text hover:opacity-70"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-center mb-4 parchment-text">
            Cannot Start Battle
          </h2>
          <p className="parchment-text text-center">
            You need to add spirits to your active party before entering battle!
          </p>
          <Button
            onClick={onClose}
            className="w-full mt-4"
            style={{
              background: "var(--vermillion)",
              color: "var(--parchment)",
            }}
          >
            Return
          </Button>
        </div>
      </div>
    );
  }

  const activeSpirit = playerSpirits[activePartySlot];
  const activeBaseSpirit = activeSpirit
    ? getBaseSpirit(activeSpirit.playerSpirit.spiritId)
    : null;
  const activeStats = activeSpirit
    ? calculateAllStats(activeSpirit.playerSpirit)
    : null;
  const availableSkills = activeSpirit
    ? getAvailableSkills(activeSpirit.playerSpirit)
    : [];
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-6xl w-full h-[90vh] p-6 rounded-lg relative flex flex-col">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm z-10"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 parchment-text hover:opacity-70 z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-4 parchment-text brush-stroke">
          {isBossBattle ? "⚔️ Boss Battle ⚔️" : "Cultivation Battle"}
        </h2>

        {/* Battle Scene Placeholder */}
        <div className="w-full h-64 bg-gradient-to-b from-amber-100 to-amber-200 rounded-lg border-4 border-amber-700 mb-4 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-20 h-20 bg-amber-800 rounded-full blur-xl"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-amber-800 rounded-full blur-xl"></div>
          </div>
          <p className="text-2xl font-bold parchment-text opacity-30 italic z-10">
            Battle Scene
          </p>
        </div>

        {/* Spirit Info Panels */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Player Spirit Info */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-blue-600">
            <h3 className="font-bold parchment-text mb-2 text-blue-800">
              Your Spirit
            </h3>
            {activeSpirit && activeBaseSpirit && activeStats ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold parchment-text text-lg">
                      {activeBaseSpirit.name}
                    </span>
                    <div className="text-xs parchment-text opacity-80">
                      <span className="capitalize">
                        Element: {activeBaseSpirit.element}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm parchment-text">
                    Lv. {activeSpirit.playerSpirit.level}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm parchment-text mb-1">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> HP
                    </span>
                    <span>
                      {activeSpirit.currentHealth} / {activeSpirit.maxHealth}
                    </span>
                  </div>
                  <motion.div
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: playerHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="bg-green-600 h-4 rounded-full transition-all"
                      style={{
                        width: `${(activeSpirit.currentHealth / activeSpirit.maxHealth) * 100}%`,
                      }}
                      animate={{
                        boxShadow: playerHealthBarHeal
                          ? [
                              "0 0 0px rgba(34, 197, 94, 0)",
                              "0 0 15px rgba(34, 197, 94, 0.8)",
                              "0 0 0px rgba(34, 197, 94, 0)",
                            ]
                          : "0 0 0px rgba(34, 197, 94, 0)",
                      }}
                      transition={{ duration: 0.6 }}
                    />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {activeStats.attack}</div>
                  <div>DEF: {activeStats.defense}</div>
                </div>
                {isBlocking && (
                  <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-400">
                    <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Blocking!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm parchment-text opacity-50">
                No active spirit
              </p>
            )}
          </div>

          {/* Enemy Spirit Info */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-red-600">
            <h3 className="font-bold parchment-text mb-2 text-red-800">
              Enemy
            </h3>
            {enemy ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold parchment-text text-lg">
                      {enemy.name}
                    </span>
                    {/* --- ADDED THIS LINE --- */}
                    <div className="text-xs parchment-text opacity-80">
                      <span className="capitalize">
                        Element: {enemy.element}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm parchment-text">
                    Lv. {enemy.level}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm parchment-text mb-1">
                    <span>HP</span>
                    <span>
                      {enemy.currentHealth} / {enemy.maxHealth}
                    </span>
                  </div>
                  <motion.div
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: enemyHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <div
                      className="bg-red-600 h-4 rounded-full transition-all"
                      style={{
                        width: `${(enemy.currentHealth / enemy.maxHealth) * 100}%`,
                      }}
                    />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {enemy.attack}</div>
                  <div>DEF: {enemy.defense}</div>
                </div>
                {isBossBattle && (
                  <div className="mt-2 space-y-1">
                    {bossState.atkBuffTurnsRemaining > 0 && (
                      <div className="p-2 bg-red-100 rounded border border-red-400">
                        <p className="text-xs font-bold text-red-800">
                          ⚡ ATK Buffed! ({bossState.atkBuffTurnsRemaining}{" "}
                          turns)
                        </p>
                      </div>
                    )}
                    {bossState.isCharging && (
                      <div className="p-2 bg-yellow-100 rounded border border-yellow-400">
                        <p className="text-xs font-bold text-yellow-800 animate-pulse">
                          ⚡ Charging...
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm parchment-text opacity-50">No enemy</p>
            )}
          </div>
        </div>

        {/* Battle Log */}
        <div className="flex-1 p-3 bg-amber-50 rounded border-2 border-amber-700 scroll-container mb-4 max-h-32">
          <div className="space-y-1 text-xs parchment-text">
            {battleLog.map((log, index) => (
              <p key={index} className="opacity-75">
                &gt; {log}
              </p>
            ))}
          </div>
        </div>

        {/* Action Buttons and Submenus */}
        {battleState === "setup" && (
          <Button
            onClick={startBattle}
            className="w-full p-4 text-lg font-bold"
            style={{
              background: "var(--vermillion)",
              color: "var(--parchment)",
            }}
          >
            Begin Battle
          </Button>
        )}

        {battleState === "fighting" &&
          activeSpirit &&
          activeSpirit.currentHealth > 0 && (
            <div>
              {actionMenu === "none" && (
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      playButtonClick();
                      availableSkills.length > 0 &&
                        handleSkillSelect(availableSkills[0].id);
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Swords className="w-6 h-6" />
                    <span>Attack</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleBlock();
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Shield className="w-6 h-6" />
                    <span>Block</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("skills");
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Swords className="w-6 h-6" />
                    <span>Skills</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("swap");
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <ArrowLeftRight className="w-6 h-6" />
                    <span>Swap</span>
                  </button>
                </div>
              )}

              {actionMenu === "skills" && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold parchment-text text-lg">
                      Select Skill
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-semibold"
                    >
                      Back
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          playButtonClick();
                          handleSkillSelect(skill.id);
                        }}
                        onMouseEnter={playButtonHover}
                        className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-left"
                      >
                        <p className="font-bold">{skill.name}</p>
                        <p className="text-xs opacity-90">
                          {skill.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {actionMenu === "swap" && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold parchment-text text-lg">
                      Swap Spirit
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-semibold"
                    >
                      Back
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {playerSpirits.map((spirit, index) => {
                      const baseSpirit = getBaseSpirit(
                        spirit.playerSpirit.spiritId,
                      );
                      const isActive = index === activePartySlot;
                      const isDead = spirit.currentHealth <= 0;

                      return (
                        <button
                          key={spirit.playerSpirit.instanceId}
                          onClick={() => {
                            if (!isDead && !isActive) playButtonClick();
                            handleSwap(index);
                          }}
                          onMouseEnter={() => {
                            if (!isDead && !isActive) playButtonHover();
                          }}
                          disabled={isDead || isActive}
                          className={`p-3 rounded-lg border-2 text-left ${
                            isActive
                              ? "border-blue-600 bg-blue-100 cursor-not-allowed"
                              : isDead
                                ? "border-gray-400 bg-gray-200 opacity-50 cursor-not-allowed"
                                : "border-green-600 bg-white hover:bg-green-50"
                          }`}
                        >
                          <p className="text-sm font-bold parchment-text truncate">
                            {baseSpirit?.name}
                          </p>
                          <p className="text-xs parchment-text">
                            Lv. {spirit.playerSpirit.level}
                          </p>
                          <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
                            <div
                              className={`h-2 rounded-full ${isDead ? "bg-gray-500" : "bg-green-600"}`}
                              style={{
                                width: `${(spirit.currentHealth / spirit.maxHealth) * 100}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        {battleState === "victory" && battleRewards && (
          <div className="p-4 bg-green-100 rounded-lg border-2 border-green-600">
            <h3 className="font-bold text-green-800 text-2xl mb-3 text-center">
              🎉 {isBossBattle ? "Boss Defeated!" : "Victory!"} 🎉
            </h3>
            <p className="text-md text-green-800 mb-3 text-center font-semibold">
              {isBossBattle
                ? "You have defeated the mighty boss! Your cultivation deepens..."
                : "You defeated the enemy! A new challenger approaches..."}
            </p>
            <div className="mb-4 space-y-2 p-3 bg-white rounded border border-green-400">
              <p className="text-lg font-bold text-green-800">
                Battle Rewards:
              </p>
              <p className="text-md text-green-800">✦ +{battleRewards.qi} Qi</p>
              <p className="text-md text-green-800">
                ✦ +{battleRewards.qiGeneration.toFixed(1)} to Qi generation per
                second
              </p>
              <p className="text-sm text-green-700 mt-2 italic">
                All spirits have been fully healed!
              </p>
            </div>
            {isBossBattle ? (
              <Button
                onClick={handleClose}
                className="w-full font-bold"
                style={{
                  background: "var(--jade-green)",
                  color: "var(--parchment)",
                }}
              >
                Return to Cultivation
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleContinueBattle}
                  className="w-full font-bold"
                  style={{
                    background: "var(--vermillion)",
                    color: "var(--parchment)",
                  }}
                >
                  Continue Battling
                </Button>
                <Button
                  onClick={handleClose}
                  className="w-full font-bold"
                  style={{
                    background: "var(--jade-green)",
                    color: "var(--parchment)",
                  }}
                >
                  Return to Cultivation
                </Button>
              </div>
            )}
          </div>
        )}

        {battleState === "defeat" && (
          <div className="p-4 bg-red-100 rounded-lg border-2 border-red-600">
            <h3 className="font-bold text-red-800 text-2xl mb-3 text-center">
              Defeat...
            </h3>
            <p className="text-md text-red-800 mb-2 text-center">
              All your spirits have been defeated.
            </p>
            <p className="text-sm text-red-700 mb-4 text-center italic">
              Return to cultivation and strengthen your spirits before trying
              again.
            </p>
            <Button
              onClick={handleClose}
              className="w-full font-bold"
              style={{
                background: "var(--vermillion)",
                color: "var(--parchment)",
              }}
            >
              Return to Cultivation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
