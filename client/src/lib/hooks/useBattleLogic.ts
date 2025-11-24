import { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  calculateAllStats,
  getAvailableSkills,
  getSkill,
  getElementalDamageMultiplier,
  getPrimaryElement,
} from "@/lib/spiritUtils";
import type {
  PlayerSpirit,
  ActiveEffect,
  BaseSpirit,
  ElementId,
  PassiveAbility,
  PassiveElementalLifesteal,
  Skill,
  CombatTrigger,
} from "@shared/types";
import passivesData from "@shared/data/passives.json";
import battleConfig from "@shared/data/battleConfig.json";
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
  affinity: number;
  elements: ElementId[];
  currentHealth: number;
  maxHealth: number;
}

/** The result of a skill execution, before state is applied */
interface AttackResult {
  totalDamage: number;
  totalHealing: number;
  logMessages: string[];
  effectsToApplyToCaster: ActiveEffect[];
  effectsToApplyToTarget: ActiveEffect[];
  wasCritical?: boolean;
}

/** New state machine for managing turn flow */
type TurnPhase =
  | "setup"
  | "round_start" // Determine turn order for this round
  | "player_start"
  | "player_action" // Waiting for player input
  | "player_execute" // Processing player's move
  | "player_end"
  | "player_forced_swap" // Player must swap after spirit death during enemy turn
  | "enemy_start"
  | "enemy_action" // Processing enemy's move
  | "enemy_end"
  | "game_over";

export function useBattleLogic({
  onClose,
  isBossBattle = false,
  returnTo = "cultivation",
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
    currentEncounterId,
    setCurrentEncounterId,
    resolveStoryBattle,
    debugEncounter,
    setDebugEncounter,
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

  const TURN_TRANSITION_DELAY = 500;

  // ========== Battle State ==========
  const [battleState, setBattleState] = useState<BattleState>("setup");
  const [turnPhase, setTurnPhase] = useState<TurnPhase>("setup");
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [messageQueue, setMessageQueue] = useState<string[]>([]); // Queue for delayed messages
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
  const [showEmptyPartyDialog, setShowEmptyPartyDialog] = useState(false);
  const [showSpiritDefeatedDialog, setShowSpiritDefeatedDialog] = useState(false);
  const [playerWentFirst, setPlayerWentFirst] = useState(false); // Track turn order for current round

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
    () => (activeSpirit ? calculateAllStats(activeSpirit.playerSpirit, activeSpirit.activeEffects) : null),
    [activeSpirit],
  );

  const availableSkills = useMemo(
    () => (activeSpirit ? getAvailableSkills(activeSpirit.playerSpirit) : []),
    [activeSpirit],
  );

  // ========== Helper Functions ==========
  const addLog = (message: string) => {
    // Add message to queue with delay
    setMessageQueue((prev) => [...prev, message]);
  };

  // Process queued messages with configured delay
  useEffect(() => {
    if (messageQueue.length === 0) return;

    const messageDelay = battleConfig.messageDisplayDelay || 250;
    const timeout = setTimeout(() => {
      const nextMessage = messageQueue[0];
      setBattleLog((prev) => [...prev, nextMessage]);
      setMessageQueue((prev) => prev.slice(1));
    }, messageDelay);

    return () => clearTimeout(timeout);
  }, [messageQueue]);

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
    const encounterData = (allEncounters as any)?.default || allEncounters;
    if (!encounterData) {
      console.error("CRITICAL: encounters.json data is not loaded.");
      return null;
    }

    // Priority 0: Check for debug encounter (takes precedence over everything)
    if (debugEncounter) {
      console.log("[Debug] Using debug encounter:", debugEncounter.id);
      // Clear the debug encounter after using it
      setDebugEncounter(null);
      return debugEncounter;
    }

    // --- 👇 ADD THIS ENTIRE BLOCK ---
    // Priority 1: Check for a story-driven encounter
    if (currentEncounterId) {
      const storyEncounter = (encounterData as Encounter[]).find(
        (enc) => enc.id === currentEncounterId,
      );

      // IMPORTANT: Clear the ID so it's not reused on the next battle
      setCurrentEncounterId(null);

      if (storyEncounter) {
        return storyEncounter;
      }

      console.error(
        `CRITICAL: Story encounter '${currentEncounterId}' not found! Falling back to random.`,
      );
    }

    // --- NEW BOSS LOGIC ---
    if (isBossBattle) {
      const bossEncounter = (encounterData as Encounter[]).find(
        (enc) => enc.id === "e_boss_01", // <-- Your boss encounter ID
      );
      if (bossEncounter) {
        return bossEncounter;
      }
      console.error("CRITICAL: Boss encounter 'e_boss_01' not found!");
      // Fallback to random if boss is missing, just in case
    }
    // --- END BOSS LOGIC ---

    const playerLevel = getPlayerAverageLevel();
    const levelRange = { min: playerLevel - 1, max: playerLevel + 1 };

    // --- MODIFIED: Filter out the boss encounter from random finds ---
    const validEncounters = (encounterData as Encounter[]).filter(
      (encounter) =>
        !encounter.id.startsWith("e_boss_") && // <-- Don't randomly find bosses
        encounter.averageLevel >= levelRange.min &&
        encounter.averageLevel <= levelRange.max,
    );

    if (validEncounters.length === 0) {
      console.warn(`No encounters found for player level ${playerLevel}`);
      // Find a non-boss fallback
      const fallback = (encounterData as Encounter[]).find(
        (enc) => !enc.id.startsWith("e_boss_"),
      );
      return fallback || (encounterData as Encounter[])[0] || null;
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
    let counterAttackDamage = 0;
    const attackerEffects: ActiveEffect[] = [];

    const calculateMinOneDamage = (rawAmount: number): number => {
      if (rawAmount <= 0) return 0;
      return Math.max(1, Math.floor(rawAmount));
    };

    if (trigger === "on_get_hit" && target && damage !== undefined) {
      // 1. Check Target's Active Effects (Thorns buff and damage_reflect_buff)
      if ("activeEffects" in target) {
        const battleSpirit = target as BattleSpirit;
        battleSpirit.activeEffects.forEach((effect) => {
          if (
            effect.effectType === "thorns" &&
            effect.damageReturnRatio &&
            damage
          ) {
            reflectedDamage += calculateMinOneDamage(
              damage * effect.damageReturnRatio,
            );
            addLog(
              `${getBaseSpirit(battleSpirit.playerSpirit.spiritId)?.name}'s Thorns reflects damage!`,
            );
          }
          if (
            effect.effectType === "damage_reflect_buff" &&
            effect.damageReflectRatio &&
            damage
          ) {
            const reflectAmount = calculateMinOneDamage(
              damage * effect.damageReflectRatio,
            );
            reflectedDamage += reflectAmount;
            addLog(
              `${getBaseSpirit(battleSpirit.playerSpirit.spiritId)?.name}'s reflective barrier deflects damage!`,
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
            if (effect.type === "damage_reflect_passive") {
              const reflectAmount = calculateMinOneDamage(
                damage * effect.ratio,
              );
              reflectedDamage += reflectAmount;
              const targetDisplayName =
                (target as Enemy).name ||
                getBaseSpirit((target as BattleSpirit).playerSpirit?.spiritId)
                  ?.name ||
                "Unknown";
              addLog(
                `${targetDisplayName}'s "${passive.name}" passive reflects damage!`,
              );
            }
          }
        }
      }

      // 3. Check for Counter Attack passive
      // First, calculate Lucky bonus for the target (defender)
      let targetLuckyBonus = 0;
      if (targetBaseSpirit && targetBaseSpirit.passiveAbilities) {
        for (const passiveId of targetBaseSpirit.passiveAbilities) {
          const passive = (passivesData as Record<string, PassiveAbility>)[
            passiveId
          ];
          if (!passive || !passive.effects) continue;
          for (const effect of passive.effects) {
            if (effect.type === "chance_boost") {
              targetLuckyBonus += effect.value;
            }
          }
        }
      }

      // Then check for counter attack chances
      if (targetBaseSpirit && targetBaseSpirit.passiveAbilities) {
        for (const passiveId of targetBaseSpirit.passiveAbilities) {
          const passive = (passivesData as Record<string, PassiveAbility>)[
            passiveId
          ];
          if (!passive || !passive.effects) continue;

          for (const effect of passive.effects) {
            if (effect.type === "counter_attack_chance") {
              // Calculate counter attack chance with Lucky passive boost
              const counterChance = Math.min(1.0, effect.chance + targetLuckyBonus);
              // Roll for counter attack
              if (Math.random() < counterChance) {
                // Get target's attack stat (with activeEffects applied)
                let targetAttack = 0;
                let targetLevel = 1;
                let attackerDefense = 1;

                if ("playerSpirit" in target) {
                  const battleTarget = target as BattleSpirit;
                  const targetStats = calculateAllStats(battleTarget.playerSpirit, battleTarget.activeEffects);
                  targetAttack = targetStats.attack;
                  targetLevel = battleTarget.playerSpirit.level;
                } else {
                  // Apply activeEffects to enemy counter-attack stats
                  const enemyStats = applyEnemyActiveEffects(target as Enemy);
                  targetAttack = enemyStats.attack;
                  targetLevel = (target as Enemy).level;
                }

                if ("playerSpirit" in attacker) {
                  const battleAttacker = attacker as BattleSpirit;
                  const attackerStats = calculateAllStats(battleAttacker.playerSpirit, battleAttacker.activeEffects);
                  attackerDefense = Math.max(1, attackerStats.defense);
                } else {
                  // Apply activeEffects to enemy defense for counter-attack damage calculation
                  const enemyStats = applyEnemyActiveEffects(attacker as Enemy);
                  attackerDefense = Math.max(1, enemyStats.defense);
                }

                // Calculate counter attack damage using simplified formula
                const levelComponent = Math.floor((2 * targetLevel) / 5) + 2;
                const attackDefenseRatio = targetAttack / attackerDefense;
                const baseDamage = Math.floor(
                  (levelComponent * 60 * attackDefenseRatio) / 50
                ) + 2;
                counterAttackDamage = Math.max(1, Math.floor(baseDamage));

                const targetDisplayName =
                  (target as Enemy).name ||
                  getBaseSpirit((target as BattleSpirit).playerSpirit?.spiritId)?.name ||
                  "Unknown";
                addLog(
                  `${targetDisplayName}'s "${passive.name}" triggers a counter attack dealing ${counterAttackDamage} damage!`
                );
              }
            }
          }
        }
      }
    }
    return { reflectedDamage, attackerEffects, counterAttackDamage };
  };
  // --- END FIX ---

  const applyStatusEffect = (
    target: BattleSpirit | Enemy,
    effect: ActiveEffect,
  ): BattleSpirit | Enemy => {
    let targetName: string;
    let targetBaseSpirit: BaseSpirit | undefined;
    
    if ("playerSpirit" in target) {
      targetBaseSpirit = getBaseSpirit(target.playerSpirit.spiritId);
      targetName = targetBaseSpirit?.name || "Player Spirit";
    } else {
      targetBaseSpirit = getBaseSpirit((target as Enemy).spiritId);
      targetName = (target as Enemy).name;
    }
    
    // Check for effect immunity passive
    if (targetBaseSpirit?.passiveAbilities) {
      for (const passiveId of targetBaseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[passiveId];
        if (!passive || !passive.effects) continue;
        
        for (const passiveEffect of passive.effects) {
          if (passiveEffect.type === "effect_immunity") {
            // Check if this immunity blocks the incoming effect
            let isBlocked = false;
            
            if (passiveEffect.effectType === effect.effectType) {
              // If it's a stat buff/debuff, check if the stat matches (or if no stat specified = blocks all)
              if (effect.effectType === "stat_buff" || effect.effectType === "stat_debuff") {
                if (!passiveEffect.stat || passiveEffect.stat === effect.stat) {
                  isBlocked = true;
                }
              } else {
                // For non-stat effects, just matching the effect type is enough
                isBlocked = true;
              }
            }
            
            if (isBlocked) {
              console.log(`🛡️ ${targetName}'s "${passive.name}" blocks ${effect.effectType}!`);
              addLog(`${targetName}'s ${passive.name} blocks the effect!`);
              return target; // Return unchanged
            }
          }
        }
      }
    }
    
    const newEffect = { ...effect, id: `${effect.effectType}_${Date.now()}` };

    const currentEffects = target.activeEffects || [];

    // Define which effect types CAN stack (allow multiple instances)
    // Only stat_buff and stat_debuff can stack
    const stackableEffects: ActiveEffect["effectType"][] = [
      "stat_buff",
      "stat_debuff",
    ];

    let updatedEffects: ActiveEffect[];
    let logMessage: string;

    console.log(`🔮 Applying ${newEffect.effectType} to ${targetName}`);
    console.log(`   Current effects (${currentEffects.length}):`, currentEffects.map(e => e.effectType));

    // Check if this is a stackable effect
    if (stackableEffects.includes(newEffect.effectType)) {
      // Stackable effects - always add as a new instance
      updatedEffects = [...currentEffects, newEffect];
      logMessage = `${targetName} is afflicted with ${effect.effectType}!`;
      console.log(`   ✅ STACKED (stackable effect type)`);
    } else {
      // Non-stackable effects - check if already present and replace
      const existingEffectIndex = currentEffects.findIndex(
        (e) => e.effectType === newEffect.effectType
      );

      if (existingEffectIndex !== -1) {
        // Effect already exists - reset its duration with the new effect data
        updatedEffects = currentEffects.map((e, i) =>
          i === existingEffectIndex ? newEffect : e
        );
        logMessage = `${targetName}'s ${effect.effectType} duration was reset!`;
        console.log(`   🔄 DURATION RESET (effect already exists)`);
      } else {
        // New effect - add it to the list
        updatedEffects = [...currentEffects, newEffect];
        
        // Customize message for disable effect
        if (effect.effectType === "disable") {
          const duration = effect.turnsRemaining === -1 ? "permanently" : `for ${effect.turnsRemaining} turn(s)`;
          logMessage = `${targetName}'s ${effect.disabledAction} action is disabled ${duration}!`;
        } else {
          logMessage = `${targetName} is afflicted with ${effect.effectType}!`;
        }
        console.log(`   ✅ NEW EFFECT APPLIED`);
      }
    }

    console.log(`   Updated effects (${updatedEffects.length}):`, updatedEffects.map(e => `${e.effectType}(${e.turnsRemaining})`));

    addLog(logMessage);
    
    // If target is a BattleSpirit, synchronize both activeEffects arrays
    if ("playerSpirit" in target) {
      return {
        ...target,
        activeEffects: updatedEffects,
        playerSpirit: {
          ...target.playerSpirit,
          activeEffects: updatedEffects,
        },
      };
    }
    
    return { ...target, activeEffects: updatedEffects };
  };

  /**
   * A generic function to find and execute triggered abilities for a spirit.
   */
  const runTriggeredAbilities = (
    trigger: CombatTrigger,
    spiritIndex: number, // The index *in playerSpirits*
    targetIndex?: number, // The index of the enemy
  ) => {
    const spirit = playerSpirits[spiritIndex];
    // Safety check in case spirit isn't fully loaded (e.g., during a swap)
    if (!spirit) return;

    const baseSpirit = getBaseSpirit(spirit.playerSpirit.spiritId);
    if (!baseSpirit || !baseSpirit.triggeredAbilities) {
      return;
    }

    const abilities = baseSpirit.triggeredAbilities.filter(
      (ab) => ab.trigger === trigger,
    );

    if (abilities.length === 0) {
      return;
    }

    const spiritStats = calculateAllStats(spirit.playerSpirit, spirit.activeEffects);

    abilities.forEach((ability) => {
      ability.effects.forEach((effect) => {
        // --- Handle HEAL effect ---
        if (effect.type === "heal") {
          const maxHeal = spiritStats.health * effect.healthRatio;
          const affinityHeal =
            spiritStats.affinity * effect.affinityRatio;
          const totalHeal = Math.floor(maxHeal + affinityHeal);

          if (totalHeal > 0) {
            setPlayerSpirits((prevSpirits) =>
              prevSpirits.map((sp, i) => {
                if (i === spiritIndex) {
                  const newHealth = Math.min(
                    sp.maxHealth,
                    sp.currentHealth + totalHeal,
                  );
                  return { ...sp, currentHealth: newHealth };
                }
                return sp;
              }),
            );
            addLog(
              `${baseSpirit.name}'s passive ability heals for ${totalHeal} HP!`,
            );
            playHeal();
            setPlayerHealthBarHeal(true);
            setTimeout(() => setPlayerHealthBarHeal(false), 300);
          }
        }

        // --- Handle STAT_BUFF effect ---
        if (effect.type === "stat_buff") {
          const newActiveEffect: ActiveEffect = {
            id: `${effect.stat}_${Date.now()}`,
            effectType: "stat_buff",
            turnsRemaining: effect.duration,
            stat: effect.stat,
            statMultiplier: 1 + effect.value, // Note: Assumes 'value' is 0.5 for +50%
          };
          setPlayerSpirits((prevSpirits) =>
            prevSpirits.map((sp, i) =>
              i === spiritIndex
                ? (applyStatusEffect(sp, newActiveEffect) as BattleSpirit)
                : sp,
            ),
          );
        }

        // --- You can add more effect handlers here (e.g., DOT, etc.) ---
      });
    });
  };

  /**
   * Ticks effects for the player.
   */
  const tickPlayerEffects = (
    spirits: BattleSpirit[],
    enemies: Enemy[],
    phase: "start_of_turn" | "end_of_turn",
  ): {
    updatedSpirits: BattleSpirit[];
    updatedEnemies: Enemy[];
    chargeUnleashed: boolean;
  } => {
    let chargeUnleashed = false;
    let updatedEnemies = [...enemies];
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
          let dotDamage = effect.damagePerTurn;

          // Apply DoT amplification if the caster has it
          if (effect.casterHasDotAmplification) {
            // Apply 30% amplification (from dot_amplification passive)
            dotDamage = Math.floor(dotDamage * 1.3);
          }

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

          // This is the original healing logic
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
            setTimeout(() => setPlayerHealthBarHeal(false), 300);
          }

          // --- BEGIN NEW CHARGE DAMAGE LOGIC ---
          if (effect.damageMultiplier && effect.targetIndex !== undefined) {
            const attackerSpirit = spirit;
            const targetEnemy = enemies[effect.targetIndex]; // Get the target

            if (attackerSpirit && targetEnemy) {
              const attackerBase = getBaseSpirit(
                attackerSpirit.playerSpirit.spiritId,
              );
              const attackerStats = calculateAllStats(
                attackerSpirit.playerSpirit,
                attackerSpirit.activeEffects,
              );

              if (attackerBase && attackerStats) {
                // 1. Prepare data
                const attackerData: CombatantStats = {
                  id: attackerSpirit.playerSpirit.instanceId,
                  name: attackerBase.name,
                  spiritId: attackerSpirit.playerSpirit.spiritId,
                  level: attackerSpirit.playerSpirit.level,
                  attack: attackerStats.attack,
                  defense: attackerStats.defense,
                  affinity: attackerStats.affinity,
                  elements: attackerBase.elements,
                  currentHealth: attackerSpirit.currentHealth,
                  maxHealth: attackerSpirit.maxHealth,
                };
                // Apply activeEffects to enemy stats for charge resolution
                const targetEnemyStats = applyEnemyActiveEffects(targetEnemy);
                const targetData: CombatantStats = {
                  id: targetEnemy.id,
                  name: targetEnemy.name,
                  spiritId: targetEnemy.spiritId,
                  level: targetEnemy.level,
                  attack: targetEnemyStats.attack,
                  defense: targetEnemyStats.defense,
                  affinity: targetEnemyStats.affinity,
                  elements: targetEnemy.elements,
                  currentHealth: targetEnemy.currentHealth,
                  maxHealth: targetEnemy.maxHealth,
                };

                // 2. Create a "dummy" skill for the charge attack
                const chargeSkill: Skill = {
                  id: `charge_unleash_${effect.id}`,
                  name: "Unleashed Charge",
                  description: "A powerful charged attack",
                  damage: effect.damageMultiplier, // Use the multiplier as the skill's damage
                  healing: 0,
                  element: effect.element || "none",
                  effects: [],
                };

                // 3. Get results
                const result = calculateAttackResult(
                  attackerData,
                  targetData,
                  chargeSkill,
                );
                result.logMessages.forEach(addLog);

                let damage = result.totalDamage;
                // Note: We don't check for enemy block, as charge attacks are special

                if (damage > 0) {
                  playDamage();
                  setEnemyHealthBarShake(true);
                  setTimeout(() => setEnemyHealthBarShake(false), 250);
                }

                // 4. Apply damage to the target enemy
                updatedEnemies = updatedEnemies.map((en, index) => {
                  if (index === effect.targetIndex) {
                    const newHealth = Math.max(0, en.currentHealth - damage);
                    return { ...en, currentHealth: newHealth };
                  }
                  return en;
                });

                // TODO: Apply trigger effects, healing, etc. (if any)
              }
            }
          }
          // --- END NEW CHARGE DAMAGE LOGIC ---
        } // <-- This closes the `else if (phase === "start_of_turn" ...)` block

        // At end_of_turn, keep all effects that aren't consumed
        // Duration decrement now happens at round end, not turn end
        if (!effectIsDone) {
          newActiveEffects.push(effect);
        }
      });

      // Synchronize both activeEffects arrays
      return { 
        ...spirit, 
        currentHealth, 
        activeEffects: newActiveEffects,
        playerSpirit: {
          ...spirit.playerSpirit,
          activeEffects: newActiveEffects,
        },
      };
    });
    return { updatedSpirits, updatedEnemies, chargeUnleashed };
  };

  /**
   * Ticks effects for the enemies.
   */
  const tickEnemyEffects = (
    enemies: Enemy[],
    spirits: BattleSpirit[],
    phase: "start_of_turn" | "end_of_turn",
  ): {
    updatedEnemies: Enemy[];
    updatedSpirits: BattleSpirit[];
    chargeUnleashed: boolean;
  } => {
    let chargeUnleashed = false;
    let updatedSpirits = [...spirits];
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
          let dotDamage = effect.damagePerTurn;

          // Apply DoT amplification if the caster has it
          if (effect.casterHasDotAmplification) {
            // Apply 30% amplification (from dot_amplification passive)
            dotDamage = Math.floor(dotDamage * 1.3);
          }

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
          if (effect.damageMultiplier && effect.targetIndex !== undefined) {
            const attackerEnemy = enemy;
            const targetSpirit = spirits[effect.targetIndex]; // Get the target

            if (attackerEnemy && targetSpirit) {
              const targetBase = getBaseSpirit(
                targetSpirit.playerSpirit.spiritId,
              );
              const targetStats = calculateAllStats(targetSpirit.playerSpirit, targetSpirit.activeEffects);

              if (targetBase && targetStats) {
                // Apply activeEffects to enemy stats for charge resolution
                const attackerEnemyStats = applyEnemyActiveEffects(attackerEnemy);
                
                // 1. Prepare data
                const attackerData: CombatantStats = {
                  id: attackerEnemy.id,
                  name: attackerEnemy.name,
                  spiritId: attackerEnemy.spiritId,
                  level: attackerEnemy.level,
                  attack: attackerEnemyStats.attack,
                  defense: attackerEnemyStats.defense,
                  affinity: attackerEnemyStats.affinity,
                  elements: attackerEnemy.elements,
                  currentHealth: attackerEnemy.currentHealth,
                  maxHealth: attackerEnemy.maxHealth,
                };
                const targetData: CombatantStats = {
                  id: targetSpirit.playerSpirit.instanceId,
                  name: targetBase.name,
                  spiritId: targetSpirit.playerSpirit.spiritId,
                  level: targetSpirit.playerSpirit.level,
                  attack: targetStats.attack,
                  defense: targetStats.defense,
                  affinity: targetStats.affinity,
                  elements: targetBase.elements,
                  currentHealth: targetSpirit.currentHealth,
                  maxHealth: targetSpirit.maxHealth,
                };

                // 2. Create a "dummy" skill for the charge attack
                const chargeSkill: Skill = {
                  id: `charge_unleash_${effect.id}`,
                  name: "Unleashed Charge",
                  description: "A powerful charged attack",
                  damage: effect.damageMultiplier, // Use the multiplier as the skill's damage
                  healing: 0,
                  element: effect.element || "none",
                  effects: [],
                };

                // 3. Get results
                const result = calculateAttackResult(
                  attackerData,
                  targetData,
                  chargeSkill,
                );
                result.logMessages.forEach(addLog);

                let damage = result.totalDamage;
                // Note: We don't check for player block, as charge attacks are special

                if (damage > 0) {
                  playDamage();
                  setPlayerHealthBarShake(true);
                  setTimeout(() => setPlayerHealthBarShake(false), 250);
                }

                // 4. Apply damage to the target spirit
                updatedSpirits = updatedSpirits.map((sp, index) => {
                  if (index === effect.targetIndex) {
                    const newHealth = Math.max(0, sp.currentHealth - damage);
                    return { ...sp, currentHealth: newHealth };
                  }
                  return sp;
                });
              }
            }
          }
        }

        // At end_of_turn, keep all effects that aren't consumed
        // Duration decrement now happens at round end, not turn end
        if (!effectIsDone) {
          newActiveEffects.push(effect);
        }
      });
      return { ...enemy, currentHealth, activeEffects: newActiveEffects };
    });
    return { updatedEnemies, updatedSpirits, chargeUnleashed };
  };

  /**
   * Ticks down effect durations for the active spirit at the end of their turn.
   * This ensures "2 turn" effects last for exactly 2 of that spirit's turns.
   */
  const tickTurnEndEffects = (
    spirits: BattleSpirit[],
    enemies: Enemy[],
    isPlayerTurn: boolean,
  ): {
    updatedSpirits: BattleSpirit[];
    updatedEnemies: Enemy[];
  } => {
    if (isPlayerTurn) {
      // Decrement effects for the ACTIVE PLAYER SPIRIT
      const updatedSpirits = spirits.map((spirit, spiritIndex) => {
        if (spiritIndex !== activePartySlot) return spirit;
        
        const baseSpirit = getBaseSpirit(spirit.playerSpirit.spiritId);
        const spiritName = baseSpirit?.name || "Player Spirit";
        console.log(`⏱️ [TICK TURN END - PLAYER] ${spiritName} - Processing ${spirit.activeEffects.length} effects`);
        
        const newActiveEffects: ActiveEffect[] = [];
        spirit.activeEffects.forEach((effect) => {
          console.log(`  📊 ${effect.effectType}(${effect.turnsRemaining})${effect.disabledAction ? ` [${effect.disabledAction}]` : ''}`);
          
          if (effect.turnsRemaining === -1) {
            // Permanent effect, keep it
            console.log(`    ✅ PERMANENT - keeping`);
            newActiveEffects.push(effect);
          } else if (effect.turnsRemaining > 1) {
            // Decrement and keep
            console.log(`    ⬇️  DECREMENTING from ${effect.turnsRemaining} to ${effect.turnsRemaining - 1}`);
            newActiveEffects.push({
              ...effect,
              turnsRemaining: effect.turnsRemaining - 1,
            });
          } else if (effect.turnsRemaining === 1) {
            // Effect expires at end of this turn - remove it
            console.log(`    ❌ EXPIRING (turnsRemaining = 1)`);
            if (effect.effectType !== "charge") {
              const effectName = effect.effectType === "disable" ? effect.disabledAction : effect.effectType;
              addLog(`${spiritName}'s ${effectName} effect has worn off.`);
            }
          }
          // else: turnsRemaining <= 0, don't push (already expired)
        });
        
        console.log(`  ✨ Updated from ${spirit.activeEffects.length} to ${newActiveEffects.length} effects`);
        
        return {
          ...spirit,
          activeEffects: newActiveEffects,
          playerSpirit: {
            ...spirit.playerSpirit,
            activeEffects: newActiveEffects,
          },
        };
      });
      return { updatedSpirits, updatedEnemies: enemies };
    } else {
      // Decrement effects for the ACTIVE ENEMY
      const updatedEnemies = enemies.map((enemy, enemyIndex) => {
        if (enemyIndex !== activeEnemyIndex) return enemy;
        
        console.log(`⏱️ [TICK TURN END - ENEMY] ${enemy.name} - Processing ${enemy.activeEffects.length} effects`);
        
        const newActiveEffects: ActiveEffect[] = [];
        enemy.activeEffects.forEach((effect) => {
          console.log(`  📊 ${effect.effectType}(${effect.turnsRemaining})${effect.disabledAction ? ` [${effect.disabledAction}]` : ''}`);
          
          if (effect.turnsRemaining === -1) {
            // Permanent effect, keep it
            console.log(`    ✅ PERMANENT - keeping`);
            newActiveEffects.push(effect);
          } else if (effect.turnsRemaining > 1) {
            // Decrement and keep
            console.log(`    ⬇️  DECREMENTING from ${effect.turnsRemaining} to ${effect.turnsRemaining - 1}`);
            newActiveEffects.push({
              ...effect,
              turnsRemaining: effect.turnsRemaining - 1,
            });
          } else if (effect.turnsRemaining === 1) {
            // Effect expires at end of this turn - remove it
            console.log(`    ❌ EXPIRING (turnsRemaining = 1)`);
            if (effect.effectType !== "charge") {
              const effectName = effect.effectType === "disable" ? effect.disabledAction : effect.effectType;
              addLog(`${enemy.name}'s ${effectName} effect has worn off.`);
            }
          }
          // else: turnsRemaining <= 0, don't push (already expired)
        });
        
        console.log(`  ✨ Updated from ${enemy.activeEffects.length} to ${newActiveEffects.length} effects`);
        
        return { ...enemy, activeEffects: newActiveEffects };
      });
      return { updatedSpirits: spirits, updatedEnemies };
    }
  };

  /**
   * Ticks down effect durations at the end of each complete round.
   * This is called after both player and enemy have acted.
   */
  const tickRoundEndEffects = (
    spirits: BattleSpirit[],
    enemies: Enemy[],
  ): {
    updatedSpirits: BattleSpirit[];
    updatedEnemies: Enemy[];
  } => {
    // Process player spirits
    const updatedSpirits = spirits.map((spirit) => {
      const newActiveEffects: ActiveEffect[] = [];
      
      spirit.activeEffects.forEach((effect) => {
        if (effect.turnsRemaining > 1) {
          // Decrement duration
          newActiveEffects.push({
            ...effect,
            turnsRemaining: effect.turnsRemaining - 1,
          });
        } else if (effect.turnsRemaining === 1) {
          // Effect expires - don't push it
          // Log expiry message (except for charges which shouldn't expire via duration)
          if (effect.effectType !== "charge") {
            const spiritName =
              getBaseSpirit(spirit.playerSpirit.spiritId)?.name ||
              "Player Spirit";
            const effectName = effect.effectType === "blind" ? "Blind" : effect.effectType;
            addLog(`${spiritName}'s ${effectName} effect has worn off.`);
          } else {
            // Charge with 1 turn shouldn't expire here, keep it
            newActiveEffects.push(effect);
          }
        } else {
          // turnsRemaining <= 0, shouldn't happen but keep for safety
          newActiveEffects.push(effect);
        }
      });
      
      // Synchronize both activeEffects arrays
      return {
        ...spirit,
        activeEffects: newActiveEffects,
        playerSpirit: {
          ...spirit.playerSpirit,
          activeEffects: newActiveEffects,
        },
      };
    });
    
    // Process enemies
    const updatedEnemies = enemies.map((enemy) => {
      const newActiveEffects: ActiveEffect[] = [];
      
      enemy.activeEffects.forEach((effect) => {
        if (effect.turnsRemaining > 1) {
          // Decrement duration
          newActiveEffects.push({
            ...effect,
            turnsRemaining: effect.turnsRemaining - 1,
          });
        } else if (effect.turnsRemaining === 1) {
          // Effect expires - don't push it
          // Log expiry message (except for charges which shouldn't expire via duration)
          if (effect.effectType !== "charge") {
            const effectName = effect.effectType === "blind" ? "Blind" : effect.effectType;
            addLog(`${enemy.name}'s ${effectName} effect has worn off.`);
          } else {
            // Charge with 1 turn shouldn't expire here, keep it
            newActiveEffects.push(effect);
          }
        } else {
          // turnsRemaining <= 0, shouldn't happen but keep for safety
          newActiveEffects.push(effect);
        }
      });
      
      return { ...enemy, activeEffects: newActiveEffects };
    });
    
    return { updatedSpirits, updatedEnemies };
  };

  // ========== Battle Flow Functions ==========

  /**
   * (Step 1 & 2) Initializes the battle, loading player and enemy spirits.
   */
  const startBattle = () => {
    // 1. Load Player Spirits
    if (activeParty.length === 0) {
      addLog("No spirits in active party!");
      setShowEmptyPartyDialog(true);
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

    // Check if spiritsInBattle is empty after filtering (corrupted save data or mismatched IDs)
    if (spiritsInBattle.length === 0) {
      addLog("No valid spirits found in active party!");
      setShowEmptyPartyDialog(true);
      return;
    }

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
          baseSpirit.baseStats.affinity *
            (1 + enemyPotentialBonus) *
            levelMultiplier,
        );
        const enemyAgility = Math.floor(
          baseSpirit.baseStats.agility *
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
          agility: enemyAgility,
          maxHealth: enemyHealth,
          currentHealth: enemyHealth,
          elements: baseSpirit.elements,
          affinity: enemyElementalAffinity,
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

    // 3. Start first round - agility will be checked in round_start phase
    setTurnPhase("round_start");
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
      // --- THIS IS THE FIX ---
      // 1. Set the "waiting" state
      setBattleState("enemy_defeated");
      // 2. Stop the turn loop
      setTurnPhase("game_over");
      // 3. We NO LONGER call confirmEnemyDefeat() here.
      //    We wait for the animation callback.

      // (All the reward and healing logic has been moved
      // to the new confirmEnemyDefeat function)
      // --- END OF FIX ---

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

    // ✨ CRITICAL: Don't nest setState calls! Use separate setter calls instead.
    // This ensures React can batch updates properly.
    setPlayerSpirits((prevSpirits) => {
      const { updatedSpirits, updatedEnemies: enemiesAfterTick, chargeUnleashed: didUnleash } =
        tickPlayerEffects(
          prevSpirits, // <-- Read CURRENT state
          battleEnemies,
          "start_of_turn",
        );
      
      console.log(`🟡 [PLAYER_TURN_START] After tickPlayerEffects - Health: ${updatedSpirits[activePartySlot]?.currentHealth}/${updatedSpirits[activePartySlot]?.maxHealth}`);
      
      // Update enemies separately (NOT inside this callback!)
      // This is done by returning immediately after setPlayerSpirits
      if (enemiesAfterTick && enemiesAfterTick.length > 0) {
        // Use setTimeout to ensure this happens AFTER the spirits state is committed
        setTimeout(() => setBattleEnemies(enemiesAfterTick), 0);
      }
      
      return updatedSpirits;
    });

    return false; // Don't actually return chargeUnleashed, it's handled in effect
  };

  /**
   * (Step 4, End) Runs end-of-turn effects for the player.
   */
  const runPlayerTurnEnd = () => {
    // ✨ CRITICAL: Don't nest setState calls! Use separate setter calls instead.
    setPlayerSpirits((prevSpirits) => {
      const { updatedSpirits, updatedEnemies } = tickPlayerEffects(
        prevSpirits, // <-- Read CURRENT state
        battleEnemies,
        "end_of_turn",
      );
      
      console.log(`🟡 [PLAYER_TURN_END] After tickPlayerEffects - Health: ${updatedSpirits[activePartySlot]?.currentHealth}/${updatedSpirits[activePartySlot]?.maxHealth}`);
      
      // Update enemies separately (NOT inside this callback!)
      if (updatedEnemies && updatedEnemies.length > 0) {
        setTimeout(() => setBattleEnemies(updatedEnemies), 0);
      }
      
      return updatedSpirits;
    });
  };

  /**
   * (Step 5) Runs start-of-turn effects for the enemy.
   */
  const runEnemyTurnStart = () => {
    addLog(`--- ${activeEnemy.name}'s Turn ---`);
    setIsEnemyBlocking(false);

    // ✨ CRITICAL: Don't nest setState calls! Use separate setter calls instead.
    setBattleEnemies((prevEnemies) => {
      const { updatedEnemies, updatedSpirits, chargeUnleashed: didUnleash } =
        tickEnemyEffects(
          prevEnemies, // <-- Read CURRENT state
          playerSpirits,
          "start_of_turn",
        );

      console.log(`🟡 [ENEMY_TURN_START] After tickEnemyEffects - Player Health: ${updatedSpirits[activePartySlot]?.currentHealth}/${updatedSpirits[activePartySlot]?.maxHealth}`);

      // Update player spirits separately (NOT inside this callback!)
      if (updatedSpirits && updatedSpirits.length > 0) {
        setTimeout(() => setPlayerSpirits(updatedSpirits), 0);
      }

      // Check for Strategic passive on enemy spirit
      const currentEnemy = updatedEnemies[activeEnemyIndex];
      const enemyBaseSpirit = getBaseSpirit(currentEnemy.spiritId);
      
      let finalEnemies = updatedEnemies;
      if (enemyBaseSpirit?.passiveAbilities?.includes("strategic")) {
        // Get agility values to determine turn order
        const currentPlayerSpirit = playerSpirits[activePartySlot];
        const playerAgility = currentPlayerSpirit ? calculateAllStats(currentPlayerSpirit.playerSpirit, currentPlayerSpirit.activeEffects).agility : 0;
        const enemyAgility = currentEnemy.agility;

        if (enemyAgility < playerAgility) {
          // Enemy is going second, apply 1-turn Strategic buff
          const strategicBuff: ActiveEffect = {
            id: `strategic_${Date.now()}`,
            effectType: "stat_buff",
            turnsRemaining: 1,
            stat: "attack",
            statMultiplier: 1.3,
          };
          
          finalEnemies = finalEnemies.map((e, i) => {
            if (i !== activeEnemyIndex) return e;
            const buffedEnemy = applyStatusEffect(e, strategicBuff) as Enemy;
            return buffedEnemy;
          });
          
          addLog(`${currentEnemy.name}'s Strategic passive activates! (+30% ATK this round)`);
        }
      }

      return finalEnemies;
    });

    return false;
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
      let possibleSkillIds = ["basic_attack"]; // Start with basic actions

      // Filter skills by unlock level (same as player spirits)
      if (enemyBaseSpirit && enemyBaseSpirit.skills) {
        const availableSkills = enemyBaseSpirit.skills
          .filter(s => s.unlockLevel <= activeEnemy.level)
          .map(s => s.skillId);
        possibleSkillIds.push(...availableSkills);
      }

      const randomIndex = Math.floor(Math.random() * possibleSkillIds.length);
      skillId = possibleSkillIds[randomIndex];
      addLog(`${activeEnemy.name} acts randomly... and chooses ${skillId}!`);
    }
    // Validate explicitly assigned skills against unlock level
    else if (skillId !== "block") {
      const enemyBaseSpirit = getBaseSpirit(activeEnemy.spiritId);
      if (enemyBaseSpirit && enemyBaseSpirit.skills) {
        const skillData = enemyBaseSpirit.skills.find(s => s.skillId === skillId);
        // Check if skill exists in spirit and if level requirement is met
        if (skillData && skillData.unlockLevel > activeEnemy.level) {
          addLog(`${activeEnemy.name} tries to use ${skillId} but it's locked! Using basic attack instead.`);
          skillId = "basic_attack";
        }
        // If skill doesn't exist in spirit's skill list, allow it anyway (encounter override)
        // This lets encounter designers give enemies special skills
      }
    }
    // --- END FIX ---

    // Check for rage effect - may override skill selection
    if (activeEnemy && activeEnemy.activeEffects) {
      const rageEffect = activeEnemy.activeEffects.find(
        (e) => e.effectType === "rage"
      );
      if (rageEffect && rageEffect.rageChance) {
        const roll = Math.random();
        if (roll < rageEffect.rageChance) {
          skillId = "basic_attack";
          addLog(`${activeEnemy.name} is overcome by rage and attacks wildly!`);
        }
      }
    }

    // Check for disable effect - prevents specific actions
    if (activeEnemy && activeEnemy.activeEffects) {
      const disableEffect = activeEnemy.activeEffects.find(
        (e) => 
          e.effectType === "disable" &&
          (e.turnsRemaining > 0 || e.turnsRemaining === -1)
      );
      
      console.log(`🚫 [ENEMY ACTION CHECK] ${skillId} - Has disable effect: ${!!disableEffect}`);
      if (disableEffect) {
        console.log(`   Disabled action: ${disableEffect.disabledAction}, turnsRemaining: ${disableEffect.turnsRemaining}`);
      }
      
      // If trying to use basic_attack and "fight" is disabled, skip the action
      if (disableEffect && disableEffect.disabledAction === "fight" && skillId === "basic_attack") {
        addLog(`${activeEnemy.name} tried to attack but couldn't! (Disabled)`);
        console.log(`   ❌ SKIPPING ACTION - fight is disabled`);
        setTurnPhase("enemy_end");
        return;
      }
    }

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
      // Delay enemy action to match battle log message delay
      setTimeout(() => {
        handleEnemyAction(getSkill("basic_attack")!);
      }, battleConfig.messageDisplayDelay);
      return;
    }
    // Delay enemy action to match battle log message delay
    setTimeout(() => {
      handleEnemyAction(skill);
    }, battleConfig.messageDisplayDelay);
  };

  const runEnemyTurnEnd = () => {
    // ✨ CRITICAL: Don't nest setState calls! Use separate setter calls instead.
    setBattleEnemies((prevEnemies) => {
      const { updatedEnemies, updatedSpirits } = tickEnemyEffects(
        prevEnemies, // <-- Read CURRENT state
        playerSpirits,
        "end_of_turn",
      );
      
      console.log(`🟡 [ENEMY_TURN_END] After tickEnemyEffects - Player Health: ${updatedSpirits[activePartySlot]?.currentHealth}/${updatedSpirits[activePartySlot]?.maxHealth}`);
      
      // Update player spirits separately (NOT inside this callback!)
      if (updatedSpirits && updatedSpirits.length > 0) {
        setTimeout(() => setPlayerSpirits(updatedSpirits), 0);
      }
      
      return updatedEnemies;
    });

    // Reset block
    setIsEnemyBlocking(false);
  };

  // ========== Master Turn Flow Controller ==========

  useEffect(() => {
    if (isPaused || battleState !== "fighting" || turnPhase === "setup") return;

    // This is the core state machine
    switch (turnPhase) {
      case "round_start":
        // Determine turn order for this round based on agility
        const currentPlayerSpirit = playerSpirits[activePartySlot];
        const currentEnemy = battleEnemies[activeEnemyIndex];
        
        if (!currentPlayerSpirit || !currentEnemy) {
          setTurnPhase("player_start"); // Fallback
          break;
        }
        
        const playerAgility = calculateAllStats(currentPlayerSpirit.playerSpirit, currentPlayerSpirit.activeEffects).agility;
        const enemyAgility = currentEnemy.agility;
        
        addLog(`--- New Round: ${activeBaseSpirit?.name} (AGI: ${playerAgility}) vs ${activeEnemy.name} (AGI: ${enemyAgility}) ---`);
        
        // Check for Strategic passive on player spirit (player-only passive)
        // Grants +30% ATK for this round only when going second
        const playerBaseSpirit = getBaseSpirit(currentPlayerSpirit.playerSpirit.spiritId);
        if (playerBaseSpirit?.passiveAbilities?.includes("strategic") && playerAgility < enemyAgility) {
          // Player is going second, apply 1-turn Strategic buff
          // Note: applyStatusEffect prevents stacking by removing existing stat_buff before applying
          const strategicBuff: ActiveEffect = {
            id: `strategic_${Date.now()}`,
            effectType: "stat_buff",
            turnsRemaining: 1,
            stat: "attack",
            statMultiplier: 1.3,
          };
          
          setPlayerSpirits((prev) =>
            prev.map((s, i) => {
              if (i !== activePartySlot) return s;
              const buffedSpirit = applyStatusEffect(s, strategicBuff) as BattleSpirit;
              return buffedSpirit;
            })
          );
          
          addLog(`${playerBaseSpirit.name}'s Strategic passive activates! (+30% ATK this round)`);
        }
        
        // Track who goes first so we know who goes second
        if (playerAgility >= enemyAgility) {
          setPlayerWentFirst(true);
          setTurnPhase("player_start");
        } else {
          setPlayerWentFirst(false);
          setTurnPhase("enemy_start");
        }
        break;

      case "player_start":
        // Check for game-ending defeat first.
        const spiritBeforeTurnStart = playerSpirits[activePartySlot];
        console.log(`🔵 [PLAYER_START] Spirit health before turn start:`, spiritBeforeTurnStart?.currentHealth, `/ ${spiritBeforeTurnStart?.maxHealth}`);
        
        if (checkGameEndCondition()) {
          return;
        }
        checkAndHandleSpiritDefeat("player");

        // (Step 3)
        const playerChargeUnleashed = runPlayerTurnStart();
        const spiritAfterTurnStart = playerSpirits[activePartySlot];
        console.log(`🔵 [PLAYER_START] Spirit health after runPlayerTurnStart:`, spiritAfterTurnStart?.currentHealth, `/ ${spiritAfterTurnStart?.maxHealth}`);
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
        // NOTE: Effect durations are decremented at round end (tickRoundEndEffects), not turn end
        // This ensures "2 turn" effects last for exactly 2 full rounds

        // --- DEFEAT CHECK (for poison, etc.) ---
        // Check if poison/etc defeated the active spirit
        if (checkGameEndCondition()) {
          return;
        }
        // This check is for DOTs
        if (checkAndHandleSpiritDefeat("player")) {
          // Spirit was defeated by poison.
          // If this was the end of a complete round (enemy went first), 
          // tick down effect durations before returning
          if (!playerWentFirst) {
            const { updatedSpirits, updatedEnemies } = tickRoundEndEffects(
              playerSpirits,
              battleEnemies
            );
            setPlayerSpirits(updatedSpirits);
            setBattleEnemies(updatedEnemies);
          }
          return;
        }
        // --- END DEFEAT CHECK ---

        setIsPaused(true); // Pause the game
        setTimeout(() => {
          // If player went first, enemy goes second. Otherwise, round is over.
          if (playerWentFirst) {
            setTurnPhase("enemy_start");
          } else {
            // Round is over - tick down effect durations before starting new round
            const { updatedSpirits, updatedEnemies } = tickRoundEndEffects(
              playerSpirits,
              battleEnemies
            );
            setPlayerSpirits(updatedSpirits);
            setBattleEnemies(updatedEnemies);
            setTurnPhase("round_start");
          }
          setIsPaused(false);
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
        // ✨ CRITICAL: runEnemyAction handles its own phase transition
        // This ensures the phase doesn't change until AFTER the action completes
        runEnemyAction();

        // --- DEFEAT CHECKS REMOVED FROM HERE ---
        // All checks will happen at the start of player_start
        // or the end of enemy_end.
        // --- END DEFEAT CHECKS ---

        // NOTE: Phase transition happens inside runEnemyAction/handleEnemyAction
        // after the setTimeout completes and state is updated
        break;

      case "enemy_end":
        // (Step 7)
        runEnemyTurnEnd(); // Tick DOTs/effects
        // NOTE: Effect durations are decremented at round end (tickRoundEndEffects), not turn end
        // This ensures "2 turn" effects last for exactly 2 full rounds

        // --- DEFEAT CHECK (for poison, etc.) ---
        // Check if poison/etc defeated the active enemy
        if (checkGameEndCondition()) {
          return;
        }
        // This check is for DOTs
        if (checkAndHandleSpiritDefeat("enemy")) {
          // Enemy was defeated by poison.
          // If this was the end of a complete round (player went first), 
          // tick down effect durations before returning
          if (playerWentFirst) {
            const { updatedSpirits, updatedEnemies } = tickRoundEndEffects(
              playerSpirits,
              battleEnemies
            );
            setPlayerSpirits(updatedSpirits);
            setBattleEnemies(updatedEnemies);
          }
          return;
        }
        // --- END DEFEAT CHECK ---

        // --- PLAYER SPIRIT DEFEAT CHECK ---
        // Check if player spirit died from enemy attack or DoT during enemy turn
        if (activeSpirit.currentHealth <= 0) {
          const hasAliveSpirits = playerSpirits.some((s) => s.currentHealth > 0);
          if (hasAliveSpirits) {
            // Player has spirits left - force manual swap
            addLog(`${activeBaseSpirit?.name} has been defeated!`);
            
            // If this was the end of a complete round (player went first), 
            // tick down effect durations before forcing the swap
            if (playerWentFirst) {
              const { updatedSpirits, updatedEnemies } = tickRoundEndEffects(
                playerSpirits,
                battleEnemies
              );
              setPlayerSpirits(updatedSpirits);
              setBattleEnemies(updatedEnemies);
            }
            
            setShowSpiritDefeatedDialog(true);
            setTurnPhase("player_forced_swap");
            return;
          }
          // No spirits left - check for game over
          if (checkGameEndCondition()) {
            return;
          }
        }
        // --- END PLAYER SPIRIT DEFEAT CHECK ---

        setIsPaused(true); // Pause the game
        setTimeout(() => {
          // If enemy went first, player goes second. Otherwise, round is over.
          if (!playerWentFirst) {
            setTurnPhase("player_start");
          } else {
            // Round is over - tick down effect durations before starting new round
            const { updatedSpirits, updatedEnemies } = tickRoundEndEffects(
              playerSpirits,
              battleEnemies
            );
            setPlayerSpirits(updatedSpirits);
            setBattleEnemies(updatedEnemies);
            setTurnPhase("round_start");
          }
          setIsPaused(false);
        }, TURN_TRANSITION_DELAY);
        break;

      case "player_forced_swap":
        // Wait for player to manually select a new spirit
        // Dialog is shown, when they click button it will open swap menu
        // Nothing to do here - just waiting
        break;
    }
    // 'player_action', 'setup', 'player_forced_swap', and 'game_over' are "waiting" states
    // and don't trigger further actions.
  }, [turnPhase, battleState, isPaused]);

  // Debug: Log status effects after actions complete
  useEffect(() => {
    if (battleState !== "fighting") return;
    
    // Log status effects when transitioning to these phases (after actions complete)
    if (turnPhase === "player_end" || turnPhase === "enemy_end") {
      const currentPlayer = playerSpirits[activePartySlot];
      const currentEnemy = battleEnemies[activeEnemyIndex];
      
      if (!currentPlayer || !currentEnemy) return;
      
      const playerBaseSpirit = getBaseSpirit(currentPlayer.playerSpirit.spiritId);
      
      console.log(`📊 === STATUS EFFECTS (after ${turnPhase === "player_end" ? "PLAYER" : "ENEMY"} action) ===`);
      
      const playerEffects = currentPlayer.activeEffects || [];
      console.log(`   Player (${playerBaseSpirit?.name || "Unknown"}):`, 
        playerEffects.length > 0 
          ? playerEffects.map(e => `${e.effectType}(${e.turnsRemaining})`)
          : ["No effects"]
      );
      
      const enemyEffects = currentEnemy.activeEffects || [];
      console.log(`   Enemy (${currentEnemy.name}):`, 
        enemyEffects.length > 0 
          ? enemyEffects.map(e => `${e.effectType}(${e.turnsRemaining})`)
          : ["No effects"]
      );
    }
  }, [turnPhase, playerSpirits, battleEnemies, battleState, activePartySlot, activeEnemyIndex]);

  /**
   * (Step 4 & 6) The single, central function for all skill logic.
   */
  const calculateAttackResult = (
    attacker: CombatantStats,
    target: CombatantStats,
    skill: Skill,
    attackerActiveEffects: ActiveEffect[] = [],
  ): AttackResult => {
    const logMessages: string[] = [];
    let totalHealing = 0;
    const effectsToApplyToCaster: ActiveEffect[] = [];
    const effectsToApplyToTarget: ActiveEffect[] = [];
    let wasCritical = false;

    const baseSpirit = getBaseSpirit(attacker.spiritId);
    if (!baseSpirit) {
      return {
        totalDamage: 0,
        totalHealing: 0,
        logMessages: ["Error: Attacker base spirit not found."],
        effectsToApplyToCaster: [],
        effectsToApplyToTarget: [],
      };
    }

    // --- 1. Determine Elemental Properties
    const spiritElement: ElementId = getPrimaryElement(baseSpirit);
    const affinityStat = attacker.affinity;
    const skillElement = skill.element;
    let affinityRatio =
      skillElement === "none" || skillElement === spiritElement ? 0.25 : 0.15;
    const attackElement =
      skillElement !== "none" ? skillElement : spiritElement;

    // --- 2. Calculate Base Damage
    const level = attacker.level;
    let attack = attacker.attack;
    const defense = Math.max(1, target.defense);
    
    // --- 2.5. Apply Fortitude Passive (conditional attack boost when afflicted)
    if (baseSpirit.passiveAbilities && attackerActiveEffects.length > 0) {
      for (const passiveId of baseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[
          passiveId
        ];
        if (!passive || !passive.effects) continue;
        for (const effect of passive.effects) {
          if (effect.type === "conditional_stat_boost" && 
              effect.condition === "has_status_effect" && 
              effect.stat === "attack") {
            attack = Math.floor(attack * (1 + effect.value));
            break;
          }
        }
      }
    }
    
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
    const baseElementalDamage =
      skill.damage > 0 ? Math.floor(affinityStat * affinityRatio) : 0;

    // --- 3. Calculate Lucky Passive Bonus (applies to all chance-based effects)
    let luckyBonus = 0;
    if (baseSpirit.passiveAbilities) {
      for (const passiveId of baseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[
          passiveId
        ];
        if (!passive || !passive.effects) continue;
        for (const effect of passive.effects) {
          if (effect.type === "chance_boost") {
            luckyBonus += effect.value;
          }
        }
      }
    }

    // --- 3.5. Check for Blind Effect (causes offensive attacks to miss)
    // Only check for offensive skills (damage > 0)
    if (skill.damage > 0) {
      const blindEffect = attackerActiveEffects.find(
        (effect) => effect.effectType === "blind" && effect.blindMissChance
      );
      
      if (blindEffect && blindEffect.blindMissChance) {
        // Lucky passive reduces miss chance
        const finalMissChance = Math.max(
          0,
          blindEffect.blindMissChance - luckyBonus
        );
        const missRoll = Math.random();
        
        if (missRoll < finalMissChance) {
          // Attack missed!
          logMessages.push(`${attacker.name}'s attack missed due to Blind!`);
          return {
            totalDamage: 0,
            totalHealing: 0,
            logMessages,
            effectsToApplyToCaster: [],
            effectsToApplyToTarget: [],
            wasCritical: false,
          };
        }
      }
    }

    // --- 4. Calculate Critical Hit Chance
    let critChance = 0.05; // Base 5% crit chance
    if (baseSpirit.passiveAbilities) {
      for (const passiveId of baseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[
          passiveId
        ];
        if (!passive || !passive.effects) continue;
        for (const effect of passive.effects) {
          if (effect.type === "crit_chance_boost") {
            critChance += effect.value;
          }
        }
      }
    }
    for (const activeEffect of attackerActiveEffects) {
      if (
        activeEffect.effectType === "crit_chance_buff" &&
        activeEffect.critChanceBoost
      ) {
        critChance += activeEffect.critChanceBoost;
      }
    }
    // Apply Lucky passive bonus to crit chance
    critChance = Math.min(1.0, critChance + luckyBonus);

    // --- 4. Calculate Final Damage
    const elementalMultiplier = getElementalDamageMultiplier(
      [attackElement],
      target.elements,
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
    } else {
      const totalBaseDamage = physicalDamage + baseElementalDamage;
      totalDamage = Math.floor(totalBaseDamage * elementalMultiplier);
      if (skill.damage > 0 && totalDamage < 1) totalDamage = 1;
      if (elementalMultiplier > 1.0)
        elementalMessage = " It's super effective!";
      else if (elementalMultiplier < 1.0)
        elementalMessage = " It was resisted...";
    }

    // --- 5. Apply Critical Hit (check for crit immunity)
    let targetHasCritImmunity = false;
    const targetBaseSpirit = getBaseSpirit(target.spiritId);
    if (targetBaseSpirit?.passiveAbilities) {
      for (const passiveId of targetBaseSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[passiveId];
        if (passive?.effects) {
          for (const effect of passive.effects) {
            if (effect.type === "crit_immunity") {
              targetHasCritImmunity = true;
              break;
            }
          }
        }
        if (targetHasCritImmunity) break;
      }
    }

    // Roll for crit first, then check immunity
    const critRoll = Math.random();
    if (skill.damage > 0 && critRoll < critChance) {
      if (targetHasCritImmunity) {
        // Crit was rolled but blocked by Stalwart
        elementalMessage += " Critical hit blocked by Stalwart!";
      } else {
        // Crit succeeds
        totalDamage = Math.floor(totalDamage * 1.5);
        wasCritical = true;
        elementalMessage += " CRITICAL HIT!";
      }
    }

    // --- 6. Log attack message
    if (skillElement === "none") {
      const finalElementalDamage = Math.floor(
        baseElementalDamage * elementalMultiplier,
      );
      logMessages.push(
        `${attacker.name} used ${skill.name}! Dealt ${totalDamage} damage ` +
          `(${physicalDamage} Physical + ${finalElementalDamage} ${attackElement.toUpperCase()}).` +
          elementalMessage,
      );
    } else {
      logMessages.push(
        `${attacker.name} used ${skill.name}! It's an ${attackElement.toUpperCase()} attack! ` +
          `Dealt ${totalDamage} total damage.` +
          elementalMessage,
      );
    }

    // --- 7. Calculate Healing
    if (skill.healing > 0) {
      const skillHealing = Math.floor(totalDamage * skill.healing);
      if (skillHealing > 0) {
        totalHealing += skillHealing;
        logMessages.push(
          `${attacker.name}'s ${skill.name} healed ${skillHealing} HP!`,
        );
      }
    }

    // Elemental Lifesteal (from passives)
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

    // Lifesteal from buff (active effects)
    if (totalDamage > 0) {
      for (const activeEffect of attackerActiveEffects) {
        if (
          activeEffect.effectType === "lifesteal_buff" &&
          activeEffect.lifestealRatio
        ) {
          const lifestealHealing = Math.floor(
            totalDamage * activeEffect.lifestealRatio,
          );
          if (lifestealHealing > 0) {
            totalHealing += lifestealHealing;
            logMessages.push(
              `${attacker.name}'s lifesteal buff healed ${lifestealHealing} HP!`,
            );
          }
        }
      }
    }

    // --- 8. Handle Skill Effects
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
              affinity: attacker.affinity,
              level: attacker.level,
            },
            targetIndex: 0, // This will be set correctly by the handler
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} is gathering power!`);
        } else if (skillEffect.type === "swap_buff_trap") {
          const newActiveEffect: ActiveEffect = {
            id: `swap_trap_${Date.now()}`,
            effectType: "swap_buff_trap",
            turnsRemaining: skillEffect.trapDuration,
            storedBuff: {
              stat: skillEffect.stat,
              value: skillEffect.value,
              duration: skillEffect.buffDuration,
            },
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} sets a swap trap!`);
        } else if (skillEffect.type === "crit_chance_buff") {
          const newActiveEffect: ActiveEffect = {
            id: `crit_buff_${Date.now()}`,
            effectType: "crit_chance_buff",
            turnsRemaining: skillEffect.duration,
            critChanceBoost: skillEffect.value,
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name}'s critical hit chance increased!`);
        } else if (skillEffect.type === "lifesteal_buff") {
          const newActiveEffect: ActiveEffect = {
            id: `lifesteal_buff_${Date.now()}`,
            effectType: "lifesteal_buff",
            turnsRemaining: skillEffect.duration,
            lifestealRatio: skillEffect.value,
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} gains lifesteal!`);
        } else if (skillEffect.type === "damage_reflect_buff") {
          const newActiveEffect: ActiveEffect = {
            id: `reflect_buff_${Date.now()}`,
            effectType: "damage_reflect_buff",
            turnsRemaining: skillEffect.duration,
            damageReflectRatio: skillEffect.ratio,
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} activates a reflective barrier!`);
        } else if (skillEffect.type === "rage") {
          const newActiveEffect: ActiveEffect = {
            id: `rage_${Date.now()}`,
            effectType: "rage",
            turnsRemaining: skillEffect.duration,
            rageChance: skillEffect.chance,
          };
          effectsToApplyToTarget.push(newActiveEffect);
          logMessages.push(`${target.name} is enraged!`);
        } else if (skillEffect.type === "blind") {
          const newActiveEffect: ActiveEffect = {
            id: `blind_${Date.now()}`,
            effectType: "blind",
            turnsRemaining: skillEffect.duration,
            blindMissChance: skillEffect.missChance,
          };
          effectsToApplyToTarget.push(newActiveEffect);
          logMessages.push(`${target.name} is blinded!`);
        } else if (skillEffect.type === "disable") {
          const newActiveEffect: ActiveEffect = {
            id: `disable_${Date.now()}`,
            effectType: "disable",
            turnsRemaining: skillEffect.duration,
            disabledAction: skillEffect.action,
          };
          effectsToApplyToTarget.push(newActiveEffect);
          logMessages.push(`${target.name}'s ${skillEffect.action} action is disabled!`);
        } else if (skillEffect.type === "apply_dot_stack") {
          // Check chance to apply (defaults to 100% if not specified)
          let applyChance = skillEffect.chance ?? 1.0;
          
          // Apply Lucky passive bonus to poison application chance
          applyChance = Math.min(1.0, applyChance + luckyBonus);
          
          const roll = Math.random();
          
          if (roll < applyChance) {
            // Calculate damage per turn based on target's max health
            const damagePerTurn = Math.floor(
              target.maxHealth * skillEffect.damageRatio,
            );
            const stacksToApply = skillEffect.stacks;

            // Check if caster has DoT amplification passive
            let casterHasDotAmplification = false;
            if (baseSpirit.passiveAbilities) {
              for (const passiveId of baseSpirit.passiveAbilities) {
                const passive = (passivesData as Record<string, PassiveAbility>)[
                  passiveId
                ];
                if (!passive || !passive.effects) continue;
                for (const effect of passive.effects) {
                  if (effect.type === "dot_damage_boost") {
                    casterHasDotAmplification = true;
                    break;
                  }
                }
                if (casterHasDotAmplification) break;
              }
            }

            // Find existing DoT on target
            const existingDot = effectsToApplyToTarget.find(
              (e) => e.effectType === "damage_over_time",
            );

            if (
              existingDot &&
              existingDot.dotStacks &&
              existingDot.damagePerTurn
            ) {
              // Stack with existing
              const newStacks = Math.min(
                (existingDot.dotStacks || 0) + stacksToApply,
                skillEffect.maxStacks,
              );
              existingDot.dotStacks = newStacks;
              existingDot.damagePerTurn = damagePerTurn * newStacks;
              existingDot.turnsRemaining = skillEffect.duration; // Refresh duration
              existingDot.casterSpiritId = attacker.spiritId;
              existingDot.casterHasDotAmplification = casterHasDotAmplification;
              logMessages.push(
                `${target.name} is poisoned! (${newStacks}/${skillEffect.maxStacks} stacks)`,
              );
            } else {
              // Create new DoT
              const newActiveEffect: ActiveEffect = {
                id: `dot_stack_${Date.now()}`,
                effectType: "damage_over_time",
                turnsRemaining: skillEffect.duration,
                damagePerTurn: damagePerTurn * stacksToApply,
                dotStacks: stacksToApply,
                casterSpiritId: attacker.spiritId,
                casterHasDotAmplification,
              };
              effectsToApplyToTarget.push(newActiveEffect);
              logMessages.push(
                `${target.name} is poisoned! (${stacksToApply}/${skillEffect.maxStacks} stacks)`,
              );
            }
          } else {
            // Poison failed to apply
            logMessages.push(`${target.name} resisted the poison!`);
          }
        } else if (skillEffect.type === "one_time_shield") {
          const newActiveEffect: ActiveEffect = {
            id: `shield_${Date.now()}`,
            effectType: "one_time_shield",
            turnsRemaining: 1,
            blocksFullHit: true,
          };
          effectsToApplyToCaster.push(newActiveEffect);
          logMessages.push(`${attacker.name} creates a protective shield!`);
        }
      }
    }

    return {
      totalDamage,
      totalHealing,
      logMessages,
      effectsToApplyToCaster,
      effectsToApplyToTarget,
      wasCritical,
    };
  };

  /**
   * (Step 4) Player's chosen attack.
   */
  const handleAttack = (skillId: string) => {
    if (turnPhase !== "player_action" || messageQueue.length > 0) return;

    // Get the CURRENT spirit from state (not a closure reference)
    const currentSpirit = playerSpirits[activePartySlot];
    
    console.log(`🎮 [HANDLE ATTACK] skillId: ${skillId}, activePartySlot: ${activePartySlot}`);
    console.log(`   currentSpirit exists: ${!!currentSpirit}`);
    console.log(`   currentSpirit.health: ${currentSpirit?.currentHealth}/${currentSpirit?.maxHealth}`);
    console.log(`   currentSpirit.activeEffects: `, currentSpirit?.activeEffects);

    // Check for disabled actions
    const isActionDisabledCheck = (action: "fight" | "skill") => {
      if (!currentSpirit?.activeEffects) {
        console.log(`🚫 [ACTION CHECK] ${action} - No activeEffects found`);
        return false;
      }
      
      console.log(`🚫 [ACTION CHECK] ${action} - Checking ${currentSpirit.activeEffects.length} effects`);
      currentSpirit.activeEffects.forEach((e, idx) => {
        console.log(`   [${idx}] ${e.effectType}(${e.turnsRemaining})${e.disabledAction ? ` action:${e.disabledAction}` : ''}`);
      });
      
      const disabled = currentSpirit.activeEffects.some(
        (effect) =>
          effect.effectType === "disable" &&
          effect.disabledAction === action &&
          (effect.turnsRemaining > 0 || effect.turnsRemaining === -1)
      );
      console.log(`   Result: Disabled = ${disabled}`);
      if (disabled) {
        const disableEffect = currentSpirit.activeEffects.find(
          (e) => e.effectType === "disable" && e.disabledAction === action
        );
        console.log(`   Effect turnsRemaining: ${disableEffect?.turnsRemaining}`);
      }
      return disabled;
    };

    const actionType = skillId === "basic_attack" ? "fight" : "skill";
    if (isActionDisabledCheck(actionType)) {
      addLog("Currently disabled!");
      console.log(`❌ ACTION BLOCKED - player cannot use ${actionType}`);
      return;
    }

    let finalSkillId = skillId;

    // Check for rage effect - may override skill selection
    if (activeSpirit && activeSpirit.activeEffects) {
      const rageEffect = activeSpirit.activeEffects.find(
        (e) => e.effectType === "rage"
      );
      if (rageEffect && rageEffect.rageChance) {
        const roll = Math.random();
        if (roll < rageEffect.rageChance) {
          finalSkillId = "basic_attack";
          addLog(`${activeBaseSpirit?.name} is overcome by rage and attacks wildly!`);
        }
      }
    }

    const skill = getSkill(finalSkillId);
    if (
      !activeSpirit ||
      !activeStats ||
      !activeEnemy ||
      !skill ||
      !activeBaseSpirit
    )
      return;

    // Apply activeEffects to enemy stats (for defense/counter-attacks)
    const enemyStats = applyEnemyActiveEffects(activeEnemy);

    // 1. Prepare data
    const attackerData: CombatantStats = {
      id: activeSpirit.playerSpirit.instanceId,
      name: activeBaseSpirit.name,
      spiritId: activeSpirit.playerSpirit.spiritId,
      level: activeSpirit.playerSpirit.level,
      attack: activeStats.attack,
      defense: activeStats.defense,
      affinity: activeStats.affinity,
      elements: activeBaseSpirit.elements,
      currentHealth: activeSpirit.currentHealth,
      maxHealth: activeSpirit.maxHealth,
    };
    const targetData: CombatantStats = {
      id: activeEnemy.id,
      name: activeEnemy.name,
      spiritId: activeEnemy.spiritId,
      level: activeEnemy.level,
      attack: enemyStats.attack,
      defense: enemyStats.defense,
      affinity: enemyStats.affinity,
      elements: activeEnemy.elements,
      currentHealth: activeEnemy.currentHealth,
      maxHealth: activeEnemy.maxHealth,
    };

    // 2. Get results
    const result = calculateAttackResult(
      attackerData,
      targetData,
      skill,
      activeSpirit.activeEffects || [],
    );
    result.logMessages.forEach(addLog);

    // Delay execution to match battle log message delay
    setTimeout(() => {
      let damage = result.totalDamage;
      if (isEnemyBlocking) {
        damage = Math.floor(damage * 0.5);
        addLog(`${activeEnemy.name} blocked! Damage reduced.`);
      }

      if (result.totalDamage > 0) {
        playDamage();
        setEnemyHealthBarShake(true);
        setTimeout(() => setEnemyHealthBarShake(false), 250);
      }

      // 3. Apply results using SAFE SINGLE UPDATER (avoid nested setState)
      // Calculate all player spirit changes first, then apply in one setState
      const { reflectedDamage, attackerEffects, counterAttackDamage } = executeTriggerEffects(
        "on_get_hit",
        activeSpirit, // Attacker
        activeEnemy, // Target (before damage applied)
        damage,
      );

      setPlayerSpirits((prev) =>
        prev.map((s, i) => {
          if (i !== activePartySlot) return s;
          let newSpirit = { ...s };
          
          // Apply healing from skill
          if (result.totalHealing > 0) {
            newSpirit.currentHealth = Math.min(
              newSpirit.maxHealth,
              newSpirit.currentHealth + result.totalHealing,
            );
            playHeal();
            setPlayerHealthBarHeal(true);
            setTimeout(() => setPlayerHealthBarHeal(false), 300);
          }
          
          // Apply effects to caster (from skill)
          result.effectsToApplyToCaster.forEach((eff) => {
            eff.targetIndex = activeEnemyIndex;
            newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
          });
          
          // Apply trigger effects to caster (e.g., from on_deal_damage triggers)
          if (attackerEffects.length > 0) {
            attackerEffects.forEach((eff) => {
              newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
            });
          }
          
          // Apply reflected damage to player
          if (reflectedDamage > 0) {
            newSpirit.currentHealth = Math.max(0, newSpirit.currentHealth - reflectedDamage);
            addLog(`${activeBaseSpirit?.name} takes ${reflectedDamage} reflected damage!`);
          }
          
          // Apply counter attack damage to player (damage is immediate, VFX is delayed)
          if (counterAttackDamage > 0) {
            newSpirit.currentHealth = Math.max(0, newSpirit.currentHealth - counterAttackDamage);
          }
          
          return newSpirit;
        }),
      );

      // Now handle enemy updates separately
      setBattleEnemies((prevEnemies) => {
        const targetEnemy = prevEnemies[activeEnemyIndex];
        let newHealth = Math.max(0, targetEnemy.currentHealth - damage);

        // Apply effects to target (e.g., DoT stacks)
        let updatedEnemy = {
          ...prevEnemies[activeEnemyIndex],
          currentHealth: newHealth,
        };
        result.effectsToApplyToTarget.forEach((eff) => {
          updatedEnemy = applyStatusEffect(updatedEnemy, eff) as Enemy;
        });

        return prevEnemies.map((en, index) =>
          index === activeEnemyIndex ? updatedEnemy : en,
        );
      });

      // Delayed VFX for counter attack (damage already applied above)
      if (counterAttackDamage > 0) {
        setTimeout(() => {
          addLog(`⚔️ COUNTER! ${activeEnemy.name} strikes back!`);
          playDamage();
          setPlayerHealthBarShake(true);
          setTimeout(() => setPlayerHealthBarShake(false), 250);
        }, 300);
      }

      // 4. Move to next phase
      setTurnPhase("player_execute");
    }, battleConfig.messageDisplayDelay);
  };

  /**
   * Helper function to apply activeEffects to enemy stats (similar to calculateAllStats for players)
   */
  const applyEnemyActiveEffects = (enemy: Enemy): { attack: number; defense: number; affinity: number; agility: number } => {
    let attack = enemy.attack;
    let defense = enemy.defense;
    let affinity = enemy.affinity;
    let agility = enemy.agility;

    const activeEffects = enemy.activeEffects || [];
    activeEffects.forEach((effect) => {
      if (
        (effect.effectType === "stat_buff" ||
          effect.effectType === "stat_debuff") &&
        effect.stat &&
        effect.statMultiplier
      ) {
        switch (effect.stat) {
          case "attack":
            attack = Math.floor(attack * effect.statMultiplier);
            break;
          case "defense":
            defense = Math.floor(defense * effect.statMultiplier);
            break;
          case "affinity":
            affinity = Math.floor(affinity * effect.statMultiplier);
            break;
          case "agility":
            agility = Math.floor(agility * effect.statMultiplier);
            break;
        }
      }
    });

    return { attack, defense, affinity, agility };
  };

  /**
   * (Step 6) Enemy's action execution.
   */
  const handleEnemyAction = (skill: Skill) => {
    if (!activeSpirit || !activeStats || !activeEnemy || !activeBaseSpirit)
      return;

    const targetBase = getBaseSpirit(activeSpirit.playerSpirit.spiritId);
    if (!targetBase) return;

    // Apply activeEffects to enemy stats
    const enemyStats = applyEnemyActiveEffects(activeEnemy);

    // 1. Prepare data
    const attackerData: CombatantStats = {
      id: activeEnemy.id,
      name: activeEnemy.name,
      spiritId: activeEnemy.spiritId,
      level: activeEnemy.level,
      attack: enemyStats.attack,
      defense: enemyStats.defense,
      affinity: enemyStats.affinity,
      elements: activeEnemy.elements,
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
      affinity: activeStats.affinity,
      elements: targetBase.elements,
      currentHealth: activeSpirit.currentHealth,
      maxHealth: activeSpirit.maxHealth,
    };

    // 2. Get results
    const result = calculateAttackResult(
      attackerData,
      targetData,
      skill,
      activeEnemy.activeEffects || []
    );
    result.logMessages.forEach(addLog);
    console.log(`🎯 [ENEMY ATTACK CALCULATED] totalDamage: ${result.totalDamage}`);

    // 3. Apply block/shield modifications
    let damage = result.totalDamage;
    if (isBlocking) {
      damage = Math.floor(damage * 0.5);
      addLog(`${activeBaseSpirit.name} blocked! Damage reduced.`);
      console.log(`🛡️  [BLOCKING] Damage reduced from ${result.totalDamage} to ${damage}`);
    }

    const hasShield = activeSpirit.activeEffects.some(
      (e) => e.effectType === "one_time_shield" && e.blocksFullHit,
    );
    if (hasShield) {
      damage = 0;
      addLog(`${activeBaseSpirit.name}'s Shield blocks the attack!`);
      console.log(`⚔️  [SHIELD BLOCK] Damage negated (was ${result.totalDamage})`);
    }

    console.log(`💥 [FINAL DAMAGE] ${damage} damage will be applied to ${activeBaseSpirit?.name}`);

    if (damage > 0) {
      playDamage();
      setPlayerHealthBarShake(true);
      setTimeout(() => setPlayerHealthBarShake(false), 250);
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
      const oldHealth = targetSpirit.currentHealth;
      const newHealth = Math.max(0, targetSpirit.currentHealth - damage);
      
      console.log(`❤️  [PLAYER SPIRIT DAMAGE]`);
      console.log(`   Spirit: ${activeBaseSpirit?.name}`);
      console.log(`   Old Health: ${oldHealth}/${targetSpirit.maxHealth}`);
      console.log(`   Damage Applied: ${damage}`);
      console.log(`   New Health: ${newHealth}/${targetSpirit.maxHealth}`);

      const { reflectedDamage, attackerEffects, counterAttackDamage } = executeTriggerEffects(
        "on_get_hit",
        activeEnemy, // Attacker
        targetSpirit, // Target
        damage,
      );

      // ✨ CRITICAL: Build updatedSpirits BEFORE applying trigger effects
      let updatedSpirits = prevSpirits.map((sp, index) =>
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

      // Apply trigger effects to the updatedSpirits (NOT a separate setState!)
      if (attackerEffects.length > 0) {
        console.log(`🔄 [APPLY TRIGGER EFFECTS] Applying ${attackerEffects.length} effects from trigger`);
        updatedSpirits = updatedSpirits.map((spirit, i) => {
          if (i !== activePartySlot) return spirit;
          let newSpirit = { ...spirit };
          attackerEffects.forEach((eff) => {
            console.log(`  ➕ Trigger effect: ${eff.effectType}(${eff.turnsRemaining})`);
            newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
          });
          return newSpirit;
        });
      }

      // Apply reflected damage to enemy
      if (reflectedDamage > 0) {
        setBattleEnemies((prev) =>
          prev.map((enemy, i) => {
            if (i !== activeEnemyIndex) return enemy;
            const newHealth = Math.max(
              0,
              enemy.currentHealth - reflectedDamage,
            );
            return { ...enemy, currentHealth: newHealth };
          }),
        );
        addLog(
          `${activeEnemy.name} takes ${reflectedDamage} reflected damage!`,
        );
        playDamage();
        setEnemyHealthBarShake(true);
        setTimeout(() => setEnemyHealthBarShake(false), 250);
      }

      // Apply counter attack damage to enemy (damage is immediate, VFX is delayed)
      if (counterAttackDamage > 0) {
        updatedSpirits = updatedSpirits; // Keep same (counter damage applied to enemy)
        setBattleEnemies((prev) =>
          prev.map((enemy, i) => {
            if (i !== activeEnemyIndex) return enemy;
            const newHealth = Math.max(
              0,
              enemy.currentHealth - counterAttackDamage,
            );
            return { ...enemy, currentHealth: newHealth };
          }),
        );
        
        // Delayed VFX only
        setTimeout(() => {
          addLog(`⚔️ COUNTER! ${activeBaseSpirit?.name} strikes back!`);
          playDamage();
          setEnemyHealthBarShake(true);
          setTimeout(() => setEnemyHealthBarShake(false), 250);
        }, 300);
      }

      // ✨ CRITICAL FIX: Apply skill effects to target (disable, debuffs, etc.)
      if (result.effectsToApplyToTarget.length > 0) {
        console.log(`🎯 [APPLY TARGET EFFECTS] Applying ${result.effectsToApplyToTarget.length} effects to player spirit`);
        updatedSpirits = updatedSpirits.map((sp, index) => {
          if (index !== activePartySlot) return sp;
          let newSpirit = { ...sp };
          result.effectsToApplyToTarget.forEach((eff) => {
            console.log(`  ➕ Applying ${eff.effectType}(${eff.turnsRemaining}) to ${getBaseSpirit(sp.playerSpirit.spiritId)?.name}`);
            newSpirit = applyStatusEffect(newSpirit, eff) as BattleSpirit;
          });
          return newSpirit;
        });
      }

      // Check if active spirit died and force swap if needed
      if (newHealth <= 0) {
        const hasOtherAliveSpirits = updatedSpirits.some(
          (s, i) => i !== activePartySlot && s.currentHealth > 0
        );
        
        if (hasOtherAliveSpirits) {
          // Spirit died but others are alive - show dialog first
          setTimeout(() => {
            addLog(`${activeBaseSpirit?.name} has been defeated!`);
            setTurnPhase("player_forced_swap");
            setShowSpiritDefeatedDialog(true);
          }, 500);
        }
      }

      // Debug: Log final state before returning
      const finalSpirit = updatedSpirits[activePartySlot];
      console.log(`✅ [FINAL STATE BEFORE RETURN]`);
      console.log(`   Active Spirit: ${getBaseSpirit(finalSpirit?.playerSpirit.spiritId)?.name}`);
      console.log(`   Final Health: ${finalSpirit?.currentHealth}/${finalSpirit?.maxHealth}`);
      console.log(`   Effects: ${finalSpirit?.activeEffects.length}`);

      console.log(`🔴 [setPlayerSpirits CALLED] Health about to be set to:`, updatedSpirits[activePartySlot]?.currentHealth);
      return updatedSpirits;
    });

    // ✨ CRITICAL: Transition phase AFTER the state update is committed
    // This ensures the player_start phase reads the updated health, not the old value
    setTimeout(() => {
      console.log(`🟢 [PHASE TRANSITION] setTurnPhase("enemy_end") called AFTER state update`);
      setTurnPhase("enemy_end");
    }, 0);
  };

  // ========== Player Action Handlers ==========

  const handleSkillSelect = (skillId: string) => {
    setActionMenu("none");
    handleAttack(skillId);
  };

  const handleBlock = () => {
    if (turnPhase !== "player_action" || messageQueue.length > 0) return;
    setIsBlocking(true);
    setActionMenu("none");
    addLog(`${activeBaseSpirit?.name} takes a defensive stance!`);
    setTurnPhase("player_execute"); // This "action" takes no time
  };

  const handleSwap = (index: number) => {
    const isForcedSwap = turnPhase === "player_forced_swap";
    
    // Allow swapping during normal player action or forced swap
    // But prevent swapping while messages are still being displayed
    if ((turnPhase !== "player_action" && !isForcedSwap) || messageQueue.length > 0) return;

    // Check for disabled spirit action (only during normal player action, not forced swap)
    if (!isForcedSwap && activeSpirit?.activeEffects) {
      const disableEffect = activeSpirit.activeEffects.find(
        (effect) =>
          effect.effectType === "disable" &&
          effect.disabledAction === "spirit" &&
          (effect.turnsRemaining > 0 || effect.turnsRemaining === -1)
      );
      console.log(`🚫 [SPIRIT SWAP CHECK] Swapping to index ${index} - Disabled: ${!!disableEffect}`);
      if (disableEffect) {
        console.log(`   Effect turnsRemaining: ${disableEffect.turnsRemaining}`);
      }
      if (disableEffect) {
        addLog("Currently disabled!");
        return;
      }
    }
    if (index === activePartySlot) return;
    if (playerSpirits[index].currentHealth <= 0) {
      addLog("Cannot swap to a defeated spirit!");
      return;
    }

    const oldSpirit = activeBaseSpirit;
    const newSpiritBase = getBaseSpirit(
      playerSpirits[index].playerSpirit.spiritId,
    );

    if (!newSpiritBase) {
      console.error(
        `Failed to find base spirit for ID: ${playerSpirits[index].playerSpirit.spiritId}`,
      );
      addLog("Error: Could not swap to spirit.");
      return;
    }
    const outgoingSpirit = playerSpirits[activePartySlot]; // Get the full BattleSpirit

    if (outgoingSpirit && outgoingSpirit.activeEffects) {
      // Find the first swap trap on the outgoing spirit
      const swapTrap = outgoingSpirit.activeEffects.find(
        (e) => e.effectType === "swap_buff_trap",
      );

      if (swapTrap && swapTrap.storedBuff) {
        const buff = swapTrap.storedBuff;
        addLog(`The ${swapTrap.effectType} on ${oldSpirit?.name} springs!`);

        // Create the new buff for the INCOMING spirit
        const newBuffEffect: ActiveEffect = {
          id: `swap_buff_${buff.stat}_${Date.now()}`,
          effectType: "stat_buff",
          turnsRemaining: buff.duration,
          stat: buff.stat,
          statMultiplier: 1 + buff.value,
        };

        // Apply the buff to the incoming spirit and remove the trap
        setPlayerSpirits((prevSpirits) =>
          prevSpirits.map((spirit, i) => {
            if (i === index) {
              // This is the INCOMING spirit
              addLog(`${newSpiritBase.name} receives a ${buff.stat} buff!`);
              return applyStatusEffect(spirit, newBuffEffect) as BattleSpirit;
            }
            if (i === activePartySlot) {
              // This is the OUTGOING spirit, remove the trap
              return {
                ...spirit,
                activeEffects: (spirit.activeEffects || []).filter(
                  (e) => e.id !== swapTrap.id,
                ),
              };
            }
            return spirit;
          }),
        );
      }
    }

    // Check for swap-out heal passive
    if (oldSpirit && oldSpirit.passiveAbilities) {
      for (const passiveId of oldSpirit.passiveAbilities) {
        const passive = (passivesData as Record<string, PassiveAbility>)[passiveId];
        if (passive && passive.effects) {
          for (const effect of passive.effects) {
            if (effect.type === "swap_out_heal") {
              const outgoingSpirit = playerSpirits[activePartySlot];
              const spiritStats = calculateAllStats(outgoingSpirit.playerSpirit, outgoingSpirit.activeEffects);
              const maxHealth = spiritStats.health;
              const healAmount = Math.floor(maxHealth * effect.healPercentage);
              
              // Apply heal to the outgoing spirit
              setPlayerSpirits((prevSpirits) =>
                prevSpirits.map((spirit, i) => {
                  if (i === activePartySlot) {
                    const newHealth = Math.min(
                      spirit.currentHealth + healAmount,
                      maxHealth
                    );
                    return {
                      ...spirit,
                      currentHealth: newHealth,
                    };
                  }
                  return spirit;
                })
              );
              
              const healPercentage = Math.round(effect.healPercentage * 100);
              addLog(
                `${oldSpirit.name} recovers ${healAmount} HP (${healPercentage}%) from ${passive.name}!`
              );
            }
          }
        }
      }
    }

    // --- NEW GENERIC TRIGGER ---
    // Run triggers for the spirit swapping *in*
    runTriggeredAbilities("on_switch_in", index);

    // Run triggers for the spirit swapping *out*
    // (We use activePartySlot here because it's the index of the spirit LEAVING)
    runTriggeredAbilities("on_switch_out", activePartySlot);
    // --- END NEW LOGIC ---

    setActivePartySlot(index);
    setActionMenu("none");
    setIsBlocking(false); // Swapping cancels block
    addLog(`Swapped ${oldSpirit?.name} for ${newSpiritBase.name}!`);
    
    // If this was a forced swap during enemy turn, continue to enemy_end
    // Otherwise, normal swap during player turn counts as the action
    if (isForcedSwap) {
      setTurnPhase("enemy_end");
    } else {
      setTurnPhase("player_execute");
    }
  };

  const handleClose = () => {
    // Check for disabled escape action
    if (battleState === "fighting" && activeSpirit?.activeEffects) {
      const disableEffect = activeSpirit.activeEffects.find(
        (effect) =>
          effect.effectType === "disable" &&
          effect.disabledAction === "escape" &&
          (effect.turnsRemaining > 0 || effect.turnsRemaining === -1)
      );
      console.log(`🚫 [ESCAPE CHECK] Escape disabled: ${!!disableEffect}`);
      if (disableEffect) {
        console.log(`   Effect turnsRemaining: ${disableEffect.turnsRemaining}`);
      }
      if (disableEffect) {
        addLog("Currently disabled!");
        return;
      }
    }

    // Save final health state
    if (battleState !== "defeat") {
      playerSpirits.forEach((spirit) => {
        updateSpiritHealth(
          spirit.playerSpirit.instanceId,
          spirit.currentHealth,
        );
      });
    }
    
    // Resolve story battle checkpoint if this was a story battle
    if (returnTo === "story") {
      if (battleState === "victory") {
        resolveStoryBattle("victory");
      } else if (battleState === "defeat") {
        resolveStoryBattle("defeat");
      }
    }
    
    playExploreMusic();
    onClose();
  };

  const confirmEnemyDefeat = () => {
    addLog("Victory! The enemy has been defeated!");
    setBattleState("victory"); // Now we set the final victory state

    // Handle rewards (this is the logic moved from checkGameEndCondition)
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
    
    // Clear all effects from game state so next battle starts fresh
    healAllSpirits();
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
    showEmptyPartyDialog,
    showSpiritDefeatedDialog,

    // Derived
    activeSpirit,
    activeBaseSpirit,
    activeStats,
    availableSkills,
    canStartBattle: playerSpirits.length > 0 && battleEnemies.length > 0,

    // Actions
    setActionMenu,
    setShowEmptyPartyDialog,
    setShowSpiritDefeatedDialog,

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
    confirmEnemyDefeat,
  };
}
