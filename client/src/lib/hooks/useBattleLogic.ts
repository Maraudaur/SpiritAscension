import { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  calculateAllStats,
  getAvailableSkills,
  getSkill,
  getElementalDamageMultiplier,
} from "@/lib/spiritUtils";
import type {
  PlayerSpirit,
  ActiveEffect,
  BaseSpirit,
  ElementId,
  PassiveAbility,
  PassiveElementalLifesteal,
  Skill,
} from "@shared/types";
import passivesData from "@shared/data/passives.json";
import type { Encounter } from "@shared/types";
import allEncounters from "@shared/data/encounters.json";
import type {
  ActionMenu,
  BattleState,
  BattleScreenProps,
  BattleSpirit,
  Enemy,
  TriggerEffectResult,
  BattleRewards,
} from "@/lib/battle-types";

// --- Helper Types ---

/** A standardized representation of any combatant for calculations */
interface CombatantStats {
  id: string; // instanceId or enemyId
  name: string;
  spiritId: string;
  level: number;
  attack: number;
  defense: number;
  elementalAffinity: number;
  element: ElementId;
  currentHealth: number;
  maxHealth: number;
}

/** The result of a skill execution, before state is applied */
interface AttackResult {
  totalDamage: number;
  totalHealing: number;
  logMessages: string[];
  effectsToApplyToCaster: ActiveEffect[];
}

/** New state machine for managing turn flow */
type TurnPhase =
  | "setup"
  | "player_start"
  | "player_action" // Waiting for player input
  | "player_execute" // Processing player's move
  | "player_end"
  | "enemy_start"
  | "enemy_action" // Processing enemy's move
  | "enemy_end"
  | "game_over";

export function useBattleLogic({ onClose }: BattleScreenProps) {
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

  const TURN_TRANSITION_DELAY = 1000;

  // ========== Battle State ==========
  const [battleState, setBattleState] = useState<BattleState>("setup");
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("setup");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [battleEnemies, setBattleEnemies] = useState<Enemy[]>([]);
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [activeEnemyIndex, setActiveEnemyIndex] = useState(0);
  const [battleRewards, setBattleRewards] = useState<BattleRewards | null>(
    null,
  );
  const [actionMenu, setActionMenu] = useState<ActionMenu>("none");
  const [isBlocking, setIsBlocking] = useState(false);
  const [isEnemyBlocking, setIsEnemyBlocking] = useState(false);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(
    null,
  );
  const [aiTurnStep, setAiTurnStep] = useState(0); // For enemy AI patterns
  const [isPaused, setIsPaused] = useState(false);

  // ========== Health Bar FX State ==========
  const [playerHealthBarShake, setPlayerHealthBarShake] = useState(false);
  const [enemyHealthBarShake, setEnemyHealthBarShake] = useState(false);
  const [playerHealthBarHeal, setPlayerHealthBarHeal] = useState(false);

  // ========== Derived Values ==========
  const activeSpirit = playerSpirits[activePartySlot];
  const activeEnemy = battleEnemies[activeEnemyIndex];

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

  // ========== Helper Functions ==========
  const addLog = (message: string) => {
    setBattleLog((prev) => [...prev, message]);
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
    const levelRange = { min: playerLevel - 1, max: playerLevel + 1 };
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

  // --- FIX: Pasted the missing executeTriggerEffects function back in ---
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
              `${getBaseSpirit(battleSpirit.playerSpirit.spiritId)?.name}'s Thorns reflects ${reflectedDamage} damage!`,
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
  // --- END FIX ---

  const applyStatusEffect = (
    target: BattleSpirit | Enemy,
    effect: ActiveEffect,
  ): BattleSpirit | Enemy => {
    let targetName: string;
    if ("playerSpirit" in target) {
      const baseSpirit = getBaseSpirit(target.playerSpirit.spiritId);
      targetName = baseSpirit?.name || "Player Spirit";
    } else {
      targetName = (target as Enemy).name;
    }
    const newEffect = { ...effect, id: `${effect.effectType}_${Date.now()}` };
    addLog(`${targetName} is afflicted with ${effect.effectType}!`);

    // Prevent charge/buff stacking
    if (
      newEffect.effectType === "charge" ||
      newEffect.effectType === "stat_buff"
    ) {
      const otherEffects = target.activeEffects.filter(
        (e) => e.effectType !== newEffect.effectType,
      );
      return { ...target, activeEffects: [...otherEffects, newEffect] };
    }
    return { ...target, activeEffects: [...target.activeEffects, newEffect] };
  };

  /**
   * Ticks effects for the player.
   */
  const tickPlayerEffects = (
    spirits: BattleSpirit[],
    phase: "start_of_turn" | "end_of_turn",
  ): { updatedSpirits: BattleSpirit[]; chargeUnleashed: boolean } => {
    let chargeUnleashed = false;
    const updatedSpirits = spirits.map((spirit) => {
      // Only tick effects for the ACTIVE spirit
      if (
        spirit.playerSpirit.instanceId !== activeSpirit.playerSpirit.instanceId
      ) {
        return spirit;
      }

      let currentHealth = spirit.currentHealth;
      const newActiveEffects: ActiveEffect[] = [];

      spirit.activeEffects.forEach((effect) => {
        let effectIsDone = false;

        // Handle DOTs (End of Turn)
        if (
          phase === "end_of_turn" &&
          effect.effectType === "damage_over_time" &&
          effect.damagePerTurn
        ) {
          const dotDamage = effect.damagePerTurn;
          const spiritName =
            getBaseSpirit(spirit.playerSpirit.spiritId)?.name ||
            "Player Spirit";
          currentHealth = Math.max(0, currentHealth - dotDamage);
          addLog(
            `${spiritName} takes ${dotDamage} damage from ${effect.effectType}!`,
          );
        }

        // Handle Charge (Start of Turn)
        else if (
          phase === "start_of_turn" &&
          effect.effectType === "charge" &&
          effect.turnsRemaining === 1 &&
          effect.casterStats
        ) {
          effectIsDone = true;
          chargeUnleashed = true;
          const spiritName =
            getBaseSpirit(spirit.playerSpirit.spiritId)?.name ||
            "Player Spirit";
          addLog(`${spiritName} unleashes their ability!`);

          // TODO: Implement charge attack/heal logic here
          // This would involve a `calculateAttackResult` call
          // and applying damage/heals.
          if (effect.healingFlat) {
            const totalHeal =
              effect.healingFlat +
              Math.floor(
                effect.casterStats.affinity *
                  (effect.healingAffinityRatio || 0),
              );
            currentHealth = Math.min(
              spirit.maxHealth,
              currentHealth + totalHeal,
            );
            addLog(`${spiritName} heals for ${totalHeal} HP!`);
            playHeal();
            setPlayerHealthBarHeal(true);
            setTimeout(() => setPlayerHealthBarHeal(false), 600);
          }
        }

        // Tick down timer
        if (phase === "end_of_turn") {
          if (!effectIsDone) {
            if (effect.turnsRemaining > 1) {
              newActiveEffects.push({
                ...effect,
                turnsRemaining: effect.turnsRemaining - 1,
              });
            } else {
              // Effect expires (if turnsRemaining was 1)
              // We DON'T want charges to expire here.
              const spiritName =
                getBaseSpirit(spirit.playerSpirit.spiritId)?.name ||
                "Player Spirit";
              if (effect.effectType !== "charge") {
                addLog(
                  `${spiritName}'s ${effect.effectType} effect has worn off.`,
                );
              } else {
                // It's a charge with 1 turn left, keep it for start_of_turn
                newActiveEffects.push(effect);
              }
            }
          }
        }
        // If it's not end_of_turn (i.e., it's start_of_turn),
        // just keep the effect unless it was just consumed.
        else if (!effectIsDone) {
          newActiveEffects.push(effect);
        }
      });

      return { ...spirit, currentHealth, activeEffects: newActiveEffects };
    });
    return { updatedSpirits, chargeUnleashed };
  };

  /**
   * Ticks effects for the enemies.
   */
  const tickEnemyEffects = (
    enemies: Enemy[],
    phase: "start_of_turn" | "end_of_turn",
  ): { updatedEnemies: Enemy[]; chargeUnleashed: boolean } => {
    let chargeUnleashed = false;
    const updatedEnemies = enemies.map((enemy) => {
      // Only tick effects for the ACTIVE enemy
      if (enemy.id !== activeEnemy.id) return enemy;

      let currentHealth = enemy.currentHealth;
      const newActiveEffects: ActiveEffect[] = [];

      enemy.activeEffects.forEach((effect) => {
        let effectIsDone = false;

        // Handle DOTs (End of Turn)
        if (
          phase === "end_of_turn" &&
          effect.effectType === "damage_over_time" &&
          effect.damagePerTurn
        ) {
          const dotDamage = effect.damagePerTurn;
          currentHealth = Math.max(0, currentHealth - dotDamage);
          addLog(
            `${enemy.name} takes ${dotDamage} damage from ${effect.effectType}!`,
          );
        }

        // Handle Charge (Start of Turn)
        else if (
          phase === "start_of_turn" &&
          effect.effectType === "charge" &&
          effect.turnsRemaining === 1 &&
          effect.casterStats
        ) {
          effectIsDone = true;
          chargeUnleashed = true;
          addLog(`${enemy.name} unleashes its ability!`);

          if (effect.healingFlat) {
            const totalHeal =
              effect.healingFlat +
              Math.floor(
                effect.casterStats.affinity *
                  (effect.healingAffinityRatio || 0),
              );
            currentHealth = Math.min(
              enemy.maxHealth,
              currentHealth + totalHeal,
            );
            addLog(`${enemy.name} heals for ${totalHeal} HP!`);
            playHeal();
          }
        }

        // Tick down timer
        if (phase === "end_of_turn") {
          if (!effectIsDone) {
            if (effect.turnsRemaining > 1) {
              newActiveEffects.push({
                ...effect,
                turnsRemaining: effect.turnsRemaining - 1,
              });
            } else {
              // Effect expires (if turnsRemaining was 1)
              // We DON'T want charges to expire here.
              if (effect.effectType !== "charge") {
                addLog(
                  `${enemy.name}'s ${effect.effectType} effect has worn off.`,
                );
              } else {
                // It's a charge with 1 turn left, keep it for start_of_turn
                newActiveEffects.push(effect);
              }
            }
          }
        }
        // If it's not end_of_turn (i.e., it's start_of_turn),
        // just keep the effect unless it was just consumed.
        else if (!effectIsDone) {
          newActiveEffects.push(effect);
        }
      });
      return { ...enemy, currentHealth, activeEffects: newActiveEffects };
    });
    return { updatedEnemies, chargeUnleashed };
  };

  // ========== Battle Flow Functions ==========

  /**
   * (Step 1 & 2) Initializes the battle, loading player and enemy spirits.
   */
  const startBattle = () => {
    // 1. Load Player Spirits
    if (activeParty.length === 0) {
      addLog("No spirits in active party!");
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
    setActivePartySlot(0);

    // 2. Load Encounter
    const encounter = findEncounter();
    setCurrentEncounter(encounter);

    if (!encounter || encounter.enemies.length === 0) {
      addLog("No valid encounter found for your level.");
      return;
    }

    const allEnemies = encounter.enemies
      .map((enemyData, index) => {
        const baseSpirit = getBaseSpirit(enemyData.spiritId);
        if (!baseSpirit || !baseSpirit.baseStats) return null;

        // Simplified enemy stat calculation (from old file)
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

    if (allEnemies.length === 0) {
      addLog("Could not load enemies for this encounter.");
      return;
    }

    setBattleEnemies(allEnemies);
    setActiveEnemyIndex(0);
    setAiTurnStep(0);
    setBattleRewards(null);
    setBattleState("fighting");
    addLog(`Encounter: ${encounter.name}!`);
    addLog("Battle begins!");
    playBattleMusic();

    // 3. Kick off the turn state machine
    setTurnPhase("player_start");
  };

  /**
   * (Step 8 & 9) Checks for party-wide defeat after any health change.
   * Returns true if the game is over, false otherwise.
   */
  const checkGameEndCondition = (): boolean => {
    // Check for player defeat
    const isPlayerDefeated = playerSpirits.every((s) => s.currentHealth <= 0);
    if (isPlayerDefeated && playerSpirits.length > 0) {
      addLog("All spirits have been defeated...");
      setBattleState("defeat");
      setTurnPhase("game_over");
      healAllSpirits(); // Restore health for next time
      return true;
    }

    // Check for enemy defeat
    const isEnemyDefeated = battleEnemies.every((e) => e.currentHealth <= 0);
    if (isEnemyDefeated && battleEnemies.length > 0) {
      addLog("Victory! The enemy has been defeated!");
      setBattleState("victory");
      setTurnPhase("game_over");

      // Handle rewards
      const rewards = currentEncounter?.rewards;
      if (rewards) {
        winBattle(rewards.qi);
        if (rewards.essences) {
          for (const [spiritId, amount] of Object.entries(rewards.essences)) {
            addEssence(spiritId, amount);
            addLog(
              `You obtained ${amount}x ${getBaseSpirit(spiritId)?.name} Essence!`,
            );
          }
        }
        setBattleRewards({ qi: rewards.qi, qiGeneration: 0.1 }); // Placeholder
      }

      // Restore player health after victory
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

      return true;
    }

    return false;
  };

  /**
   * (Step 8 cont.) Checks if the active spirit is defeated and swaps if necessary.
   * Returns true if a swap occurred, false otherwise.
   */
  const checkAndHandleSpiritDefeat = (type: "player" | "enemy"): boolean => {
    if (type === "player" && activeSpirit.currentHealth <= 0) {
      addLog(`${activeBaseSpirit?.name} has been defeated!`);
      const nextAliveIndex = playerSpirits.findIndex(
        (s) => s.currentHealth > 0,
      );
      if (nextAliveIndex !== -1) {
        addLog(
          `${getBaseSpirit(playerSpirits[nextAliveIndex].playerSpirit.spiritId)?.name} enters the battle!`,
        );
        setActivePartySlot(nextAliveIndex);
        return true;
      }
      return false; // No one left to swap to
    }

    if (type === "enemy" && activeEnemy.currentHealth <= 0) {
      addLog(`${activeEnemy.name} has been defeated!`);
      const nextAliveIndex = battleEnemies.findIndex(
        (e) => e.currentHealth > 0,
      );
      if (nextAliveIndex !== -1) {
        addLog(`A new enemy appears: ${battleEnemies[nextAliveIndex].name}!`);
        setActiveEnemyIndex(nextAliveIndex);
        setAiTurnStep(0); // Reset AI for new enemy
        return true;
      }
      return false; // No one left to swap to
    }

    return false;
  };

  // ========== Turn Phase Functions ==========

  /**
   * (Step 3) Runs start-of-turn effects for the player.
   */
  const runPlayerTurnStart = () => {
    addLog(`--- ${activeBaseSpirit?.name}'s Turn ---`);
    setIsBlocking(false);

    // 1. Get the results from the tick function *first*
    const { updatedSpirits, chargeUnleashed } = tickPlayerEffects(
      playerSpirits, // <-- Use the current state
      "start_of_turn",
    );

    // 2. Set the new state
    setPlayerSpirits(updatedSpirits);

    // 3. Return the result
    return chargeUnleashed;
  };

  /**
   * (Step 4, End) Runs end-of-turn effects for the player.
   */
  const runPlayerTurnEnd = () => {
    // 1. Get the results from the tick function *first*
    const { updatedSpirits } = tickPlayerEffects(
      playerSpirits, // <-- Use the current state
      "end_of_turn",
    );
    // 2. Set the new state
    setPlayerSpirits(updatedSpirits);
  };

  /**
   * (Step 5) Runs start-of-turn effects for the enemy.
   */
  const runEnemyTurnStart = () => {
    addLog(`--- ${activeEnemy.name}'s Turn ---`);
    setIsEnemyBlocking(false); // <-- ADD THIS

    // 1. Get the results from the tick function *first*
    const { updatedEnemies, chargeUnleashed } = tickEnemyEffects(
      battleEnemies, // <-- Use the current state
      "start_of_turn",
    );

    // 2. Set the new state
    setBattleEnemies(updatedEnemies);

    // 3. Return the result
    return chargeUnleashed;
  };

  /**
   * (Step 6) Runs the enemy's AI and executes their chosen action.
   */
  const runEnemyAction = () => {
    if (!activeEnemy || !currentEncounter) return;

    // 1. Get AI Skill ID
    const enemyAiData = currentEncounter.enemies[activeEnemyIndex];
    let skillId = enemyAiData.ai[aiTurnStep % enemyAiData.ai.length];
    setAiTurnStep((prev) => prev + 1);

    // --- FIX: Handle "r000" for random AI ---
    if (skillId === "r000") {
      const enemyBaseSpirit = getBaseSpirit(activeEnemy.spiritId);
      let possibleSkillIds = ["basic_attack", "block"]; // Start with basic actions

      // --- FIX 2: Added safety checks ---
      // Safely check if the spirit and its skills exist before adding them
      if (enemyBaseSpirit && enemyBaseSpirit.skills) {
        possibleSkillIds.push(...enemyBaseSpirit.skills);
      }
      // --- END FIX 2 ---

      const randomIndex = Math.floor(Math.random() * possibleSkillIds.length);
      skillId = possibleSkillIds[randomIndex];
      addLog(`${activeEnemy.name} acts randomly... and chooses ${skillId}!`);
    }
    // --- END FIX ---

    // Handle the chosen action
    if (skillId === "block") {
      // Handle block as a special action
      setIsEnemyBlocking(true);
      addLog(`${activeEnemy.name} takes a defensive stance!`);
      setTurnPhase("enemy_end"); // Blocking ends the turn
      return;
    }

    const skill = getSkill(skillId);
    if (!skill) {
      addLog(
        `Error: Enemy AI skill "${skillId}" not found. Defaulting to basic attack.`,
      );
      handleEnemyAction(getSkill("basic_attack")!);
      return;
    }
    handleEnemyAction(skill);
  };

  const runEnemyTurnEnd = () => {
    // 1. Get the results from the tick function *first*
    const { updatedEnemies } = tickEnemyEffects(
      battleEnemies, // <-- Use the current state
      "end_of_turn",
    );
    // 2. Set the new state
    setBattleEnemies(updatedEnemies);

    // 3. Reset block
    setIsEnemyBlocking(false);
  };

  // ========== Master Turn Flow Controller ==========

  useEffect(() => {
    if (isPaused || battleState !== "fighting" || turnPhase === "setup") return;

    // This is the core state machine
    switch (turnPhase) {
      case "player_start":
        // Check for game-ending defeat first.
        if (checkGameEndCondition()) {
          return;
        }
        checkAndHandleSpiritDefeat("player");

        // (Step 3)
        const playerChargeUnleashed = runPlayerTurnStart();
        if (playerChargeUnleashed) {
          addLog(`${activeBaseSpirit?.name}'s turn was used by the charge!`);
          setTurnPhase("player_end"); // Skip to end of turn
        } else {
          setTurnPhase("player_action"); // Proceed as normal
          setActionMenu("none");
        }
        break;

      case "player_execute":
        // Action was performed. Now check if the enemy was defeated.
        // --- DEFEAT CHECK (MOVED HERE) ---
        if (checkGameEndCondition()) {
          return; // Game is over
        }
        checkAndHandleSpiritDefeat("enemy");
        // --- END DEFEAT CHECK ---

        setTurnPhase("player_end");
        break;

      case "player_end":
        // (Step 4, End)
        runPlayerTurnEnd(); // Tick DOTs/effects

        // --- DEFEAT CHECK (for poison, etc.) ---
        // Check if poison/etc defeated the active spirit
        if (checkGameEndCondition()) {
          return;
        }
        // This check is for DOTs
        if (checkAndHandleSpiritDefeat("player")) {
          // Spirit was defeated by poison.
          return;
        }
        // --- END DEFEAT CHECK ---

        setIsPaused(true); // Pause the game
        setTimeout(() => {
          setTurnPhase("enemy_start"); // Move to next turn
          setIsPaused(false); // Unpause for enemy turn
        }, TURN_TRANSITION_DELAY);
        break;

      case "enemy_start":
        // --- DEFEAT CHECK (MOVED HERE) ---
        // Check for game-ending defeat first.
        if (checkGameEndCondition()) {
          return; // Stop processing if game is over
        }
        checkAndHandleSpiritDefeat("enemy");
        // --- END DEFEAT CHECK ---

        // (Step 5)
        const enemyChargeUnleashed = runEnemyTurnStart();
        if (enemyChargeUnleashed) {
          addLog(`${activeEnemy.name}'s turn was used by the charge!`);
          setTurnPhase("enemy_end"); // Skip to end of turn
        } else {
          setTurnPhase("enemy_action"); // Proceed as normal
        }
        break;

      case "enemy_action":
        // (Step 6)
        runEnemyAction(); // Enemy performs its action, player health is updated via setPlayerSpirits

        // --- DEFEAT CHECKS REMOVED FROM HERE ---
        // All checks will happen at the start of player_start
        // or the end of enemy_end.
        // --- END DEFEAT CHECKS ---

        setTurnPhase("enemy_end");
        break;

      case "enemy_end":
        // (Step 7)
        runEnemyTurnEnd(); // Tick DOTs/effects

        // --- DEFEAT CHECK (for poison, etc.) ---
        // Check if poison/etc defeated the active enemy
        if (checkGameEndCondition()) {
          return;
        }
        // This check is for DOTs
        if (checkAndHandleSpiritDefeat("enemy")) {
          // Enemy was defeated by poison.
          return;
        }
        // --- END DEFEAT CHECK ---

        setIsPaused(true); // Pause the game
        setTimeout(() => {
          setTurnPhase("player_start"); // Loop back to player
          setIsPaused(false); // Unpause for player turn
        }, TURN_TRANSITION_DELAY);
        break;
    }
    // 'player_action', 'setup', and 'game_over' are "waiting" states
    // and don't trigger further actions.
  }, [turnPhase, battleState, isPaused]);

  /**
   * (Step 4 & 6) The single, central function for all skill logic.
   */
  const calculateAttackResult = (
    attacker: CombatantStats,
    target: CombatantStats,
    skill: Skill,
  ): AttackResult => {
    const logMessages: string[] = [];
    let totalHealing = 0;
    const effectsToApplyToCaster: ActiveEffect[] = [];

    const baseSpirit = getBaseSpirit(attacker.spiritId);
    if (!baseSpirit) {
      return {
        totalDamage: 0,
        totalHealing: 0,
        logMessages: ["Error: Attacker base spirit not found."],
        effectsToApplyToCaster: [],
      };
    }

    // --- 1. Determine Elemental Properties
    const spiritElement: ElementId = baseSpirit.element;
    const affinityStat = attacker.elementalAffinity;
    const skillElement = skill.element;
    let affinityRatio =
      skillElement === "none" || skillElement === spiritElement ? 0.25 : 0.15;
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // --- 2. Calculate Base Damage
    const level = attacker.level;
    const attack = attacker.attack;
    const defense = Math.max(1, target.defense);
    const STATIC_BASE_POWER = 60;
    const GAME_SCALING_FACTOR = 50;
    const levelComponent = Math.floor((2 * level) / 5) + 2;
    const attackDefenseRatio = attack / defense;
    const baseCalculation =
      Math.floor(
        (levelComponent * STATIC_BASE_POWER * attackDefenseRatio) /
          GAME_SCALING_FACTOR,
      ) + 2;
    const physicalDamage = Math.floor(baseCalculation * skill.damage);
    const baseElementalDamage = Math.floor(affinityStat * affinityRatio);

    // --- 3. Calculate Final Damage
    const elementalMultiplier = getElementalDamageMultiplier(
      attackElement,
      target.element,
    );
    let totalDamage = 0;
    let elementalMessage = "";

    if (skillElement === "none") {
      const finalElementalDamage = Math.floor(
        baseElementalDamage * elementalMultiplier,
      );
      totalDamage = physicalDamage + finalElementalDamage;
      if (skill.damage > 0 && totalDamage < 1) totalDamage = 1;
      if (finalElementalDamage > 0) {
        if (elementalMultiplier > 1.0)
          elementalMessage = " It's super effective!";
        else if (elementalMultiplier < 1.0)
          elementalMessage = " It was resisted...";
      }
      logMessages.push(
        `${attacker.name} used ${skill.name}! Dealt ${totalDamage} damage ` +
          `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
          elementalMessage,
      );
    } else {
      const totalBaseDamage = physicalDamage + baseElementalDamage;
      totalDamage = Math.floor(totalBaseDamage * elementalMultiplier);
      if (skill.damage > 0 && totalDamage < 1) totalDamage = 1;
      if (elementalMultiplier > 1.0)
        elementalMessage = " It's super effective!";
      else if (elementalMultiplier < 1.0)
        elementalMessage = " It was resisted...";
      logMessages.push(
        `${attacker.name} used ${skill.name}! It's an ${attackElement.toUpperCase()} attack! ` +
          `Dealt ${totalDamage} total damage.` +
          elementalMessage,
      );
    }

    // --- 4. Calculate Healing
    if (skill.healing > 0) {
      const skillHealing = Math.floor(totalDamage * skill.healing);
      if (skillHealing > 0) {
        totalHealing += skillHealing;
        logMessages.push(
          `${attacker.name}'s ${skill.name} healed ${skillHealing} HP!`,
        );
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
              logMessages.push(
                `${attacker.name}'s "${passive.name}" passive healed ${lifestealHealing} HP!`,
              );
            }
          }
        }
      }
    }

    // --- 5. Handle Skill Effects
    if (skill.effects && skill.effects.length > 0) {
      for (const skillEffect of skill.effects) {
        if (skillEffect.type === "charge") {
          const newActiveEffect: ActiveEffect = {
            id: `charge_${Date.now()}`,
            effectType: "charge",
            turnsRemaining: skillEffect.duration,
            damageMultiplier: skillEffect.damageMultiplier,
            healingFlat: skillEffect.healingFlat,
            healingAffinityRatio: skillEffect.healingAffinityRatio,
            element: skillEffect.element,
            casterStats: {
              attack: attacker.attack,
              affinity: attacker.elementalAffinity,
              level: attacker.level,
            },
            targetIndex: 0, // This will be set correctly by the handler
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} is gathering power!`);
        }
      }
    }

    return { totalDamage, totalHealing, logMessages, effectsToApplyToCaster };
  };

  /**
   * (Step 4) Player's chosen attack.
   */
  const handleAttack = (skillId: string) => {
    if (turnPhase !== "player_action") return;

    const skill = getSkill(skillId);
    if (
      !activeSpirit ||
      !activeStats ||
      !activeEnemy ||
      !skill ||
      !activeBaseSpirit
    )
      return;

    // 1. Prepare data
    const attackerData: CombatantStats = {
      id: activeSpirit.playerSpirit.instanceId,
      name: activeBaseSpirit.name,
      spiritId: activeSpirit.playerSpirit.spiritId,
      level: activeSpirit.playerSpirit.level,
      attack: activeStats.attack,
      defense: activeStats.defense,
      elementalAffinity: activeStats.elementalAffinity,
      element: activeBaseSpirit.element,
      currentHealth: activeSpirit.currentHealth,
      maxHealth: activeSpirit.maxHealth,
    };
    const targetData: CombatantStats = {
      id: activeEnemy.id,
      name: activeEnemy.name,
      spiritId: activeEnemy.spiritId,
      level: activeEnemy.level,
      attack: activeEnemy.attack,
      defense: activeEnemy.defense,
      elementalAffinity: activeEnemy.elementalAffinity,
      element: activeEnemy.element,
      currentHealth: activeEnemy.currentHealth,
      maxHealth: activeEnemy.maxHealth,
    };

    // 2. Get results
    const result = calculateAttackResult(attackerData, targetData, skill);
    result.logMessages.forEach(addLog);

    let damage = result.totalDamage;
    if (isEnemyBlocking) {
      damage = Math.floor(damage * 0.5);
      addLog(`${activeEnemy.name} blocked! Damage reduced.`);
    }

    if (result.totalDamage > 0) {
      playDamage();
      setEnemyHealthBarShake(true);
      setTimeout(() => setEnemyHealthBarShake(false), 500);
    }

    // 3. Apply results using safe updaters
    setPlayerSpirits((prev) =>
      prev.map((s, i) => {
        if (i !== activePartySlot) return s;
        let newSpirit = { ...s };
        if (result.totalHealing > 0) {
          newSpirit.currentHealth = Math.min(
            newSpirit.maxHealth,
            newSpirit.currentHealth + result.totalHealing,
          );
          playHeal();
          setPlayerHealthBarHeal(true);
          setTimeout(() => setPlayerHealthBarHeal(false), 600);
        }
        result.effectsToApplyToCaster.forEach((eff) => {
          eff.targetIndex = activeEnemyIndex; // Set correct target
          newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
        });
        return newSpirit;
      }),
    );

    setBattleEnemies((prevEnemies) => {
      const targetEnemy = prevEnemies[activeEnemyIndex];
      const newHealth = Math.max(
        0,
        targetEnemy.currentHealth - result.totalDamage,
      );

      const { reflectedDamage, attackerEffects } = executeTriggerEffects(
        "on_get_hit",
        activeSpirit, // Attacker
        targetEnemy, // Target
        result.totalDamage,
      );

      if (attackerEffects.length > 0) {
        setPlayerSpirits((prev) =>
          prev.map((spirit, i) => {
            if (i !== activePartySlot) return spirit;
            let newSpirit = { ...spirit };
            // --- FIX: This loop now has the correct type for `eff` ---
            attackerEffects.forEach((eff) => {
              newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
            });
            return newSpirit;
          }),
        );
      }

      // TODO: Apply reflectedDamage to player

      return prevEnemies.map((en, index) =>
        index === activeEnemyIndex ? { ...en, currentHealth: newHealth } : en,
      );
    });

    // 4. Move to next phase
    setTurnPhase("player_execute");
  };

  /**
   * (Step 6) Enemy's action execution.
   */
  const handleEnemyAction = (skill: Skill) => {
    if (!activeSpirit || !activeStats || !activeEnemy || !activeBaseSpirit)
      return;

    const targetBase = getBaseSpirit(activeSpirit.playerSpirit.spiritId);
    if (!targetBase) return;

    // 1. Prepare data
    const attackerData: CombatantStats = {
      id: activeEnemy.id,
      name: activeEnemy.name,
      spiritId: activeEnemy.spiritId,
      level: activeEnemy.level,
      attack: activeEnemy.attack,
      defense: activeEnemy.defense,
      elementalAffinity: activeEnemy.elementalAffinity,
      element: activeEnemy.element,
      currentHealth: activeEnemy.currentHealth,
      maxHealth: activeEnemy.maxHealth,
    };
    const targetData: CombatantStats = {
      id: activeSpirit.playerSpirit.instanceId,
      name: activeBaseSpirit.name,
      spiritId: activeSpirit.playerSpirit.spiritId,
      level: activeSpirit.playerSpirit.level,
      attack: activeStats.attack,
      defense: activeStats.defense,
      elementalAffinity: activeStats.elementalAffinity,
      element: targetBase.element,
      currentHealth: activeSpirit.currentHealth,
      maxHealth: activeSpirit.maxHealth,
    };

    // 2. Get results
    const result = calculateAttackResult(attackerData, targetData, skill);
    result.logMessages.forEach(addLog);

    // 3. Apply block/shield modifications
    let damage = result.totalDamage;
    if (isBlocking) {
      damage = Math.floor(damage * 0.5);
      addLog(`${activeBaseSpirit.name} blocked! Damage reduced.`);
    }

    const hasShield = activeSpirit.activeEffects.some(
      (e) => e.effectType === "one_time_shield" && e.blocksFullHit,
    );
    if (hasShield) {
      damage = 0;
      addLog(`${activeBaseSpirit.name}'s Shield blocks the attack!`);
    }

    if (damage > 0) {
      playDamage();
      setPlayerHealthBarShake(true);
      setTimeout(() => setPlayerHealthBarShake(false), 500);
    }

    // 4. Apply results using safe updaters
    setBattleEnemies((prev) =>
      prev.map((e, i) => {
        if (i !== activeEnemyIndex) return e;
        let newEnemy = { ...e };
        if (result.totalHealing > 0) {
          newEnemy.currentHealth = Math.min(
            newEnemy.maxHealth,
            newEnemy.currentHealth + result.totalHealing,
          );
          playHeal();
        }
        result.effectsToApplyToCaster.forEach((eff) => {
          eff.targetIndex = activePartySlot; // Set correct target
          newEnemy = applyStatusEffect(newEnemy, eff) as Enemy;
        });
        return newEnemy;
      }),
    );

    setPlayerSpirits((prevSpirits) => {
      const targetSpirit = prevSpirits[activePartySlot];
      const newHealth = Math.max(0, targetSpirit.currentHealth - damage);

      const { reflectedDamage, attackerEffects } = executeTriggerEffects(
        "on_get_hit",
        activeEnemy, // Attacker
        targetSpirit, // Target
        damage,
      );

      if (attackerEffects.length > 0) {
        setBattleEnemies((prev) =>
          prev.map((enemy, i) => {
            if (i !== activeEnemyIndex) return enemy;
            let newEnemy = { ...enemy };
            // --- FIX: This loop now has the correct type for `eff` ---
            attackerEffects.forEach((eff) => {
              newEnemy = applyStatusEffect(newEnemy, eff) as Enemy;
            });
            return newEnemy;
          }),
        );
      }

      // TODO: Apply reflectedDamage to enemy

      return prevSpirits.map((sp, index) =>
        index === activePartySlot
          ? {
              ...sp,
              currentHealth: newHealth,
              activeEffects: hasShield
                ? sp.activeEffects.filter(
                    (e) => !(e.effectType === "one_time_shield"),
                  )
                : sp.activeEffects,
            }
          : sp,
      );
    });
    // The useEffect will catch the health change and trigger
    // the end-of-turn logic.
  };

  // ========== Player Action Handlers ==========

  const handleSkillSelect = (skillId: string) => {
    setActionMenu("none");
    handleAttack(skillId);
  };

  const handleBlock = () => {
    if (turnPhase !== "player_action") return;
    setIsBlocking(true);
    setActionMenu("none");
    addLog(`${activeBaseSpirit?.name} takes a defensive stance!`);
    setTurnPhase("player_execute"); // This "action" takes no time
  };

  const handleSwap = (index: number) => {
    if (turnPhase !== "player_action" || index === activePartySlot) return;
    if (playerSpirits[index].currentHealth <= 0) {
      addLog("Cannot swap to a defeated spirit!");
      return;
    }

    const oldSpirit = activeBaseSpirit;
    const newSpirit = getBaseSpirit(playerSpirits[index].playerSpirit.spiritId);
    setActivePartySlot(index);
    setActionMenu("none");
    setIsBlocking(false); // Swapping cancels block
    addLog(`Swapped ${oldSpirit?.name} for ${newSpirit?.name}!`);
    setTurnPhase("player_execute"); // Swapping counts as the action
  };

  const handleClose = () => {
    // Save final health state
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

  return {
    // State
    battleState,
    turnPhase,
    activePartySlot,
    activeParty,
    battleLog,
    playerSpirits,
    battleEnemies,
    activeEnemyIndex,
    activeEnemy,
    battleRewards,
    actionMenu,
    isBlocking,
    isPaused,
    playerHealthBarShake,
    enemyHealthBarShake,
    playerHealthBarHeal,
    currentEncounter,

    // Derived
    activeSpirit,
    activeBaseSpirit,
    activeStats,
    availableSkills,
    canStartBattle: playerSpirits.length > 0 && battleEnemies.length > 0,

    // Actions
    setActionMenu,

    // Audio
    isMuted,
    toggleMute,
    playButtonClick,
    playButtonHover,

    // Battle Flow Functions
    startBattle,
    handleClose,

    // Player Action Handlers
    handleSwap,
    handleBlock,
    handleSkillSelect,
  };
}
