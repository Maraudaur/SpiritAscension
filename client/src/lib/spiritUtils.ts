import type {
  PlayerSpirit,
  BaseSpirit,
  Element,
  Lineage,
  Skill,
  PotentialGrade,
  ElementId,
  ActiveEffect,
  PassiveAbility, // This is now the interface
  PassiveEffect,
  PassiveStatBoost,
  StatType,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";
import elementsData from "@shared/data/elements.json";
import lineagesData from "@shared/data/lineages.json";
import skillsData from "@shared/data/skills.json";
import passivesData from "@shared/data/passives.json";
import { POTENTIAL_BONUSES } from "./stores/useGameState";

const ELEMENTAL_MATRIX: Record<ElementId, Record<ElementId, number>> = {
  wood: {
    earth: 1.5,
    metal: 0.5,
    water: 1.0,
    fire: 1.0,
    wood: 1.0,
    none: 1.0,
  },
  earth: {
    water: 1.5,
    wood: 0.5,
    metal: 1.0,
    fire: 1.0,
    earth: 1.0,
    none: 1.0,
  },
  water: {
    fire: 1.5,
    earth: 0.5,
    wood: 1.0,
    metal: 1.0,
    water: 1.0,
    none: 1.0,
  },
  fire: {
    metal: 1.5,
    water: 0.5,
    wood: 1.0,
    earth: 1.0,
    fire: 1.0,
    none: 1.0,
  },
  metal: {
    wood: 1.5,
    fire: 0.5,
    water: 1.0,
    earth: 1.0,
    metal: 1.0,
    none: 1.0,
  },
  none: { wood: 1.0, water: 1.0, metal: 1.0, earth: 1.0, fire: 1.0, none: 1.0 },
} as const;

export function getPrimaryElement(spirit: BaseSpirit): ElementId {
  return spirit.elements[0] || "none";
}

export function getElementalDamageMultiplier(
  attackerElements: ElementId | ElementId[],
  defenderElements: ElementId | ElementId[],
): number {
  const attackerArray = Array.isArray(attackerElements) ? attackerElements : [attackerElements];
  const defenderArray = Array.isArray(defenderElements) ? defenderElements : [defenderElements];
  
  if (attackerArray.length === 0 || defenderArray.length === 0) {
    return 1.0;
  }
  
  const allMultipliers: number[] = [];
  for (const atkElem of attackerArray) {
    for (const defElem of defenderArray) {
      allMultipliers.push(ELEMENTAL_MATRIX[atkElem]?.[defElem] || 1.0);
    }
  }
  
  return Math.max(...allMultipliers);
}

export function getBaseSpirit(spiritId: string): BaseSpirit | undefined {
  for (const rarity of Object.values(spiritsData)) {
    const spirit = (rarity as BaseSpirit[]).find((s) => s.id === spiritId);
    if (spirit) return spirit as BaseSpirit;
  }
  return undefined;
}

export function getRandomEnemy() {
  // 1. Add 'as BaseSpirit[]' to fix the type error
  const allSpirits: BaseSpirit[] = Object.values(
    spiritsData,
  ) as unknown as BaseSpirit[];

  // Safety check in case spiritsData is empty
  if (allSpirits.length === 0) {
    // You can customize this error
    throw new Error("No spirits loaded from spirits.json");
  }

  const allowedRarities = ["common", "uncommon", "rare"];

  const eligibleSpirits = allSpirits.filter((spirit) =>
    allowedRarities.includes(spirit.rarity),
  );

  // 2. Updated fallback logic
  // If no spirits match the rarity (e.g., you only have 'epic' spirits)
  // this will just pick the first spirit from the entire list.
  if (eligibleSpirits.length === 0) {
    const fallbackSpirit = allSpirits[0];
    return {
      ...fallbackSpirit,
      currentHp: fallbackSpirit.baseStats.health,
      maxHp: fallbackSpirit.baseStats.health,
    };
  }

  const randomIndex = Math.floor(Math.random() * eligibleSpirits.length);
  const randomSpirit = eligibleSpirits[randomIndex];

  return {
    ...randomSpirit,
    currentHp: randomSpirit.baseStats.health,
    maxHp: randomSpirit.baseStats.health,
  };
}

export function getElement(elementId: string): Element {
  return (elementsData as Record<string, Element>)[elementId];
}

export function getElementColor(elementId: ElementId): string {
  const battlePalette: Record<ElementId, string> = {
    wood: "#3a5c44",
    earth: "#6b5437",
    fire: "#9a342a",
    water: "#2d5580",
    metal: "#4a4a4a",
    none: "#e5e7eb",
  };
  return battlePalette[elementId] || "#3d3d3d";
}

export function getLineage(lineageId: string): Lineage {
  return (lineagesData as Record<string, Lineage>)[lineageId];
}

export function getSkill(skillId: string): Skill {
  return (skillsData as Record<string, Skill>)[skillId];
}

export function getPassiveAbility(abilityId: string): PassiveAbility {
  // Cast passivesData to the correct object type
  return (passivesData as Record<string, PassiveAbility>)[abilityId];
}

export function calculateStat(
  baseStat: number,
  level: number,
  potential: PotentialGrade,
): number {
  const potentialBonus = POTENTIAL_BONUSES[potential];
  const baseWithPotential = baseStat * (1 + potentialBonus);
  return Math.floor(baseWithPotential * (level * 0.02));
}

export function calculateAllStats(
  playerSpirit: PlayerSpirit,
  battleActiveEffects?: ActiveEffect[]
) {
  const baseSpirit = getBaseSpirit(playerSpirit.spiritId);
  if (!baseSpirit) {
    return { attack: 0, defense: 0, health: 0, affinity: 0, agility: 0 };
  }

  let attack = calculateStat(
    baseSpirit.baseStats.attack,
    playerSpirit.level,
    playerSpirit.potentialFactors.attack,
  );

  let defense = calculateStat(
    baseSpirit.baseStats.defense,
    playerSpirit.level,
    playerSpirit.potentialFactors.defense,
  );

  let health =
    calculateStat(
      baseSpirit.baseStats.health,
      playerSpirit.level,
      playerSpirit.potentialFactors.health,
    ) + 10; // Base health addition is kept

  let affinity = calculateStat(
    baseSpirit.baseStats.affinity,
    playerSpirit.level,
    playerSpirit.potentialFactors.affinity,
  );

  let agility = calculateStat(
    baseSpirit.baseStats.agility,
    playerSpirit.level,
    playerSpirit.potentialFactors.agility || "C", // Default to C for legacy saves
  );

  // Apply active effects (stat buffs/debuffs)
  // Use battleActiveEffects if provided (during battle), otherwise use playerSpirit.activeEffects
  const activeEffects = battleActiveEffects !== undefined 
    ? battleActiveEffects 
    : (playerSpirit.activeEffects || []);
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
        case "health":
          health = Math.floor(health * effect.statMultiplier);
          break;
        case "affinity":
          affinity = Math.floor(
            affinity * effect.statMultiplier,
          );
          break;
        case "agility":
          agility = Math.floor(agility * effect.statMultiplier);
          break;
      }
    }
  });

  // --- REPLACEMENT LOGIC FOR PASSIVES ---
  // This block replaces the old switch statement

  // Create a mutable stats object from the values calculated so far
  const stats = { attack, defense, health, affinity, agility };

  // Apply passive abilities
  if (baseSpirit.passiveAbilities && passivesData) {
    for (const passiveId of baseSpirit.passiveAbilities) {
      // Find the passive by its ID (e.g., "health_focus")
      const passive = (passivesData as any)[passiveId] as PassiveAbility;

      if (passive && passive.effects) {
        for (const effect of passive.effects as PassiveEffect[]) {
          // This function only handles stat boosts.
          // Other effects like "elemental_lifesteal"
          // will be handled in BattleScreen.tsx.
          if (effect.type === "stat_boost") {
            const statBoost = effect as PassiveStatBoost;
            // Get the stat name (e.g., "health")
            const statKey = statBoost.stat as keyof typeof stats;

            if (stats[statKey]) {
              // Apply the value from the effect (e.g., 0.1)
              stats[statKey] *= 1 + statBoost.value;
            }
          }
        }
      }
    }
  }

  // Return the final, floored stats, just as the old code did
  return {
    attack: Math.floor(stats.attack),
    defense: Math.floor(stats.defense),
    health: Math.floor(stats.health),
    affinity: Math.floor(stats.affinity),
    agility: Math.floor(stats.agility),
  };
}

export function getAvailableSkills(playerSpirit: PlayerSpirit): Skill[] {
  const baseSpirit = getBaseSpirit(playerSpirit.spiritId);
  if (!baseSpirit) return [];

  return baseSpirit.skills
    .filter((spiritSkill) => spiritSkill.unlockLevel <= playerSpirit.level)
    .map((spiritSkill) => getSkill(spiritSkill.skillId))
    .filter((skill) => skill !== undefined) as Skill[];
}

export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: "#9ca3af",
    uncommon: "#22c55e",
    rare: "#3b82f6",
    epic: "#a855f7",
    legendary: "#f59e0b",
    boss: "#8B0000",
  };
  return colors[rarity] || colors.common;
}

export function getPotentialColor(grade: PotentialGrade): string {
  const colors: Record<PotentialGrade, string> = {
    D: "#6b7280",
    C: "#9ca3af",
    B: "#22c55e",
    A: "#3b82f6",
    S: "#a855f7",
    SS: "#f59e0b",
  };
  return colors[grade];
}
