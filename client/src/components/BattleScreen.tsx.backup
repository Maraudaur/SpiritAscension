import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  getRarityColor,
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
  CustomEffect,
  PassiveAbility,
  PassiveElementalLifesteal,
  BasicAttackConversionEffect,
  StatBuffEffect,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";
import passivesData from "@shared/data/passives.json";
import type { Encounter } from "@shared/types"; // Import your new type
import allEncounters from "@shared/data/encounters.json";

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
  spiritId: string; // <-- You need this
  name: string;
  level: number;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  baseAttack?: number;
  element: ElementId;
  elementalAffinity: number;
  activeEffects: ActiveEffect[];
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
  const [battleState, setBattleState] = useState<
    "setup" | "fighting" | "victory" | "defeat"
  >("setup");
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [battleEnemies, setBattleEnemies] = useState<Enemy[]>([]);
  const [activeEnemyIndex, setActiveEnemyIndex] = useState(0);
  const activeEnemy = battleEnemies[activeEnemyIndex];
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
      // Fallback
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
      spiritId: "boss_01", // <-- Add this
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

  // 1. Calculate player's average party level
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

  // 2. Find and select a matching encounter
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

  // 4. Use the encounter to set up your battle state
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(
    null,
  );

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
              spiritId: enemyData.spiritId, // <-- Add this
              name: baseSpirit.name,
              level: enemyData.level,
              attack: enemyAttack,
              defense: enemyDefense,
              maxHealth: enemyHealth,
              currentHealth: enemyHealth,
              element: baseSpirit.element,
              elementalAffinity: enemyElementalAffinity,
              activeEffects: [],
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

  const addLog = (message: string) => {
    setBattleLog((prev) => [...prev, message]);
  };

  interface TriggerEffectResult {
    reflectedDamage: number;
    attackerEffects: ActiveEffect[];
  }

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

  const handleAttack = (skillId: string) => {
    if (
      !activeEnemy ||
      battleState !== "fighting" ||
      playerSpirits.length === 0
    )
      return;

    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;

    const skill = getSkill(skillId);
    const stats = calculateAllStats(activeSpirit.playerSpirit);
    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);

    if (!skill || !baseSpirit) return;

    // 1. Determine Elemental Properties
    const spiritElement: ElementId = baseSpirit.element;
    const affinityStat = stats.elementalAffinity;
    const skillElement = skill.element;

    let affinityRatio = 0;
    if (skillElement === "none" || skillElement === spiritElement) {
      affinityRatio = 0.25;
    } else {
      affinityRatio = 0.15;
    }
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // 2. Calculate Physical Damage
    const level = activeSpirit.playerSpirit.level;
    const attack = stats.attack;
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
      1,
      Math.floor(baseCalculation * skill.damage),
    );

    // 3. Calculate Elemental Damage
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);

    // 4. Calculate Final Damage
    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      activeEnemy.element,
    );

    let totalDamage = 0;
    let elementalMessage = "";

    if (skillElement === "none") {
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

    // 5. Apply Damage and Handle Healing/Victory
    const newEnemyHealth = Math.max(0, activeEnemy.currentHealth - totalDamage);

    playDamage();
    setEnemyHealthBarShake(true);
    setTimeout(() => setEnemyHealthBarShake(false), 500);

    // --- REFACTORED HEALING BLOCK (This was correct) ---
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
    // --- END REFACTORED HEALING BLOCK ---

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

  const enemyTurn = (specifiedTargetIndex?: number) => {
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

    // --- FIX: This is the first corrected block ---
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

      // --- FIX: Use object destructuring ---
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
        const { updatedSpirits } = tickEffects(withDamage, activeEnemy);
        const updatedTarget = updatedSpirits[targetIndex];
        if (updatedTarget && updatedTarget.currentHealth <= 0) {
          setTimeout(
            () => checkDefeat(updatedTarget.currentHealth, targetIndex),
            0,
          );
        }
        return updatedSpirits;
      });

      // --- FIX: Combine all enemy state updates into ONE call ---
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
          return; // Stop the turn
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
        // --- FIX: This is the second corrected block ---
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

        // --- FIX: Use object destructuring ---
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
          const { updatedSpirits } = tickEffects(withDamage, activeEnemy);
          const updatedTarget = updatedSpirits[targetIndex];
          if (updatedTarget && updatedTarget.currentHealth <= 0) {
            setTimeout(
              () => checkDefeat(updatedTarget.currentHealth, targetIndex),
              0,
            );
          }

          return updatedSpirits;
        });

        // --- FIX: Combine all enemy state updates into ONE call ---
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
            return; // Stop the turn
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

    function executeNormalEnemyTurn = (
      targetIndex: number,
      target: BattleSpirit,
      stats: any,
    ) => {
      if (!activeEnemy) {
        addLog("Error: Enemy turn failed (no enemy).");
        return;
      }
      if (!currentEncounter || currentEncounter.enemies.length === 0) {
        // Fallback simple attack
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

      // --- AI and Skill logic (This was correct) ---
      const enemyData = currentEncounter.enemies[activeEnemyIndex]; // Use activeEnemyIndex
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
      // --- End AI and Skill logic ---

      // --- Damage Calculation (This was correct) ---
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
      const physicalDamage = Math.max(
        1,
        Math.floor(baseCalculation * finalSkill.damage),
      );
      const baseElementalDamage = Math.floor(affinityStat * affinityRatio);
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
        totalDamage = Math.max(
          1,
          Math.floor(totalBaseDamage * elementalMultiplier),
        );
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
      // --- End Damage Calculation ---

      // --- Apply Block, Shield, and Damage ---
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

      // --- FIX: Use object destructuring ---
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
                activeEffects: shieldBlocked
                  ? s.activeEffects.filter(
                      (e) =>
                        !(e.effectType === "one_time_shield" && e.blocksFullHit),
                    )
                  : s.activeEffects,
              }
            : s,
        );
        const { updatedSpirits } = tickEffects(withDamage, activeEnemy);
        const updatedTarget = updatedSpirits[targetIndex];
        if (updatedTarget && updatedTarget.currentHealth <= 0) {
          setTimeout(
            () => checkDefeat(updatedTarget.currentHealth, targetIndex),
            0,
          );
        }
        return updatedSpirits;
      });

      // --- FIX: Combine all enemy state updates into ONE call ---
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
          return; // Stop the turn
        }
      }

      setBossState((prev) => ({ ...prev, patternStep: prev.patternStep + 1 }));
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
      const encounter = findEncounter();
      setCurrentEncounter(encounter);

      let newEnemies: Enemy[] = [];
      let logMessage = "No more encounters found at this level.";

    if (encounter && encounter.enemies.length > 0) {
      // 2. Generate ALL enemies from this new encounter
      // (This logic is copied from your useEffect)
      newEnemies = encounter.enemies
        .map((enemyData, index) => {
          // <-- FIX: Loop all enemies
          const baseSpirit = getBaseSpirit(enemyData.spiritId);
          if (!baseSpirit || !baseSpirit.baseStats) return null;

          // Stat calculation
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
            name: baseSpirit.name,
            level: enemyData.level,
            attack: enemyAttack,
            defense: enemyDefense,
            maxHealth: enemyHealth,
            currentHealth: enemyHealth,
            element: baseSpirit.element,
            elementalAffinity: enemyElementalAffinity,
          };
        })
        .filter((e): e is Enemy => e !== null); // Filter out any nulls

      if (newEnemies.length > 0) {
        logMessage = `A new challenger appears: ${encounter.name}!`;
      } else {
        logMessage = "Could not load enemies for the next encounter.";
      }
    }

    // 3. Reset the battle state
    if (newEnemies.length > 0) {
      // <-- FIX: Check array length
      setBattleEnemies(newEnemies); // <-- FIX: Set the new array
      setActiveEnemyIndex(0); // <-- FIX: Reset to the first enemy
      setBattleState("fighting");
      setBattleRewards(null);
      setActivePartySlot(0); // Reset player to their first spirit
      setActionMenu("none");
      setIsBlocking(false);
      setBattleLog([logMessage, "The battle continues!"]);
    } else {
      setBattleLog([logMessage, "Please return to the main screen."]);
      setBattleState("setup"); // Go back to a safe state
    }
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
            {activeEnemy ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold parchment-text text-lg">
                      {activeEnemy.name}
                    </span>
                    {/* --- ADDED THIS LINE --- */}
                    <div className="text-xs parchment-text opacity-80">
                      <span className="capitalize">
                        Element: {activeEnemy.element}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm parchment-text">
                    Lv. {activeEnemy.level}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm parchment-text mb-1">
                    <span>HP</span>
                    <span>
                      {activeEnemy.currentHealth} / {activeEnemy.maxHealth}
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
                        width: `${(activeEnemy.currentHealth / activeEnemy.maxHealth) * 100}%`,
                      }}
                    />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {activeEnemy.attack}</div>
                  <div>DEF: {activeEnemy.defense}</div>
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

        {/* --- SETUP BLOCK --- */}
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

        {/* --- FIGHTING BLOCK --- */}
        {battleState === "fighting" &&
          activeSpirit &&
          activeSpirit.currentHealth > 0 && (
            <div>
              {actionMenu === "none" && (
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleSkillSelect("basic_attack");
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
                  <div className="grid grid-cols-2 gap-3">
                    {playerSpirits.map((spirit, index) => {
                      const baseSpirit = getBaseSpirit(
                        spirit.playerSpirit.spiritId,
                      );
                      const element = baseSpirit
                        ? getElement(baseSpirit.element)
                        : null;
                      const lineage = baseSpirit
                        ? getLineage(baseSpirit.lineage)
                        : null;
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
                          className={`p-3 rounded-lg border-2 text-left flex gap-3 ${
                            isActive
                              ? "border-blue-600 bg-blue-100 cursor-not-allowed"
                              : isDead
                                ? "border-gray-400 bg-gray-200 opacity-50 cursor-not-allowed"
                                : "border-green-600 bg-white hover:bg-green-50"
                          }`}
                        >
                          <img
                            src="/icons/placeholdericon.png"
                            alt={baseSpirit?.name}
                            className="w-24 h-24 object-contain flex-shrink-0"
                          />
                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold parchment-text truncate flex-1">
                                {baseSpirit?.name}
                              </p>
                              <span className="text-xs parchment-text ml-2">
                                Lv. {spirit.playerSpirit.level}
                              </span>
                            </div>
                            {element && lineage && (
                              <div className="flex justify-between items-center mb-2">
                                <span
                                  className={`text-xs element-${element.id}`}
                                >
                                  {element.name} | {lineage.name}
                                </span>
                                {baseSpirit && (
                                  <span
                                    className="text-xs font-bold px-1.5 py-0.5 rounded ml-1 flex-shrink-0"
                                    style={{
                                      background: getRarityColor(
                                        baseSpirit.rarity,
                                      ),
                                      color: "white",
                                    }}
                                  >
                                    {baseSpirit.rarity[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="w-full bg-gray-300 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${isDead ? "bg-gray-500" : "bg-green-600"}`}
                                style={{
                                  width: `${(spirit.currentHealth / spirit.maxHealth) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* --- VICTORY BLOCK --- */}
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

        {/* --- DEFEAT BLOCK --- */}
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
