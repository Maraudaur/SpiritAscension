import type {
  PlayerSpirit,
  BaseSpirit,
  Element,
  Lineage,
  Skill,
  PassiveAbility,
  PotentialGrade,
  ElementId,
  ActiveEffect,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";
import elementsData from "@shared/data/elements.json";
import lineagesData from "@shared/data/lineages.json";
import skillsData from "@shared/data/skills.json";
import { POTENTIAL_BONUSES } from "./stores/useGameState";

const ELEMENTAL_MATRIX: Record<ElementId, Record<ElementId, number>> = {
  wood: {
    water: 1.5,
    fire: 0.75,
    earth: 1.0,
    metal: 1.0,
    wood: 1.0,
    none: 1.0,
  },
  water: {
    metal: 1.5,
    wood: 0.75,
    earth: 1.0,
    fire: 1.0,
    water: 1.0,
    none: 1.0,
  },
  metal: {
    earth: 1.5,
    water: 0.75,
    wood: 1.0,
    fire: 1.0,
    metal: 1.0,
    none: 1.0,
  },
  earth: {
    fire: 1.5,
    metal: 0.75,
    wood: 1.0,
    water: 1.0,
    earth: 1.0,
    none: 1.0,
  },
  fire: {
    wood: 1.5,
    earth: 0.75,
    metal: 1.0,
    water: 1.0,
    fire: 1.0,
    none: 1.0,
  },
  none: { wood: 1.0, water: 1.0, metal: 1.0, earth: 1.0, fire: 1.0, none: 1.0 },
} as const;

export function getElementalDamageMultiplier(
  attackerElement: ElementId,
  defenderElement: ElementId,
): number {
  return ELEMENTAL_MATRIX[attackerElement]?.[defenderElement] || 1.0;
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

export function getLineage(lineageId: string): Lineage {
  return (lineagesData as Record<string, Lineage>)[lineageId];
}

export function getSkill(skillId: string): Skill {
  return (skillsData as Record<string, Skill>)[skillId];
}

export function calculateStat(
  baseStat: number,
  level: number,
  potential: PotentialGrade,
): number {
  const potentialBonus = POTENTIAL_BONUSES[potential];
  const baseWithPotential = baseStat * (1 + potentialBonus);
  return Math.floor(baseWithPotential * (level * 0.2));
}

export function getPassiveBonus(ability: PassiveAbility): number {
  return 0.1;
}

export function calculateAllStats(playerSpirit: PlayerSpirit) {
  const baseSpirit = getBaseSpirit(playerSpirit.spiritId);
  if (!baseSpirit) {
    return { attack: 0, defense: 0, health: 0, elementalAffinity: 0 };
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

  let health = calculateStat(
    baseSpirit.baseStats.health,
    playerSpirit.level,
    playerSpirit.potentialFactors.health,
  );

  let elementalAffinity = calculateStat(
    baseSpirit.baseStats.elementalAffinity,
    playerSpirit.level,
    playerSpirit.potentialFactors.elementalAffinity,
  );

  // Apply active effects (stat buffs/debuffs)
  const activeEffects = playerSpirit.activeEffects || [];
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
        case "elementalAffinity":
          elementalAffinity = Math.floor(
            elementalAffinity * effect.statMultiplier,
          );
          break;
      }
    }
  });

  const passiveBonus = getPassiveBonus(baseSpirit.passiveAbility);

  return {
    attack:
      baseSpirit.passiveAbility === "attack"
        ? Math.floor(attack * (1 + passiveBonus))
        : attack,
    defense:
      baseSpirit.passiveAbility === "defense"
        ? Math.floor(defense * (1 + passiveBonus))
        : defense,
    health:
      baseSpirit.passiveAbility === "health"
        ? Math.floor(health * (1 + passiveBonus))
        : health,
    elementalAffinity,
  };
}

export function getAvailableSkills(playerSpirit: PlayerSpirit): Skill[] {
  const baseSpirit = getBaseSpirit(playerSpirit.spiritId);
  if (!baseSpirit) return [];

  return baseSpirit.skills
    .map((skillId) => getSkill(skillId))
    .filter((skill) => skill && skill.unlockLevel <= playerSpirit.level);
}

export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: "#9ca3af",
    uncommon: "#22c55e",
    rare: "#3b82f6",
    epic: "#a855f7",
    legendary: "#f59e0b",
  };
  return colors[rarity] || colors.common;
}

export function getPotentialColor(grade: PotentialGrade): string {
  const colors: Record<PotentialGrade, string> = {
    C: "#9ca3af",
    B: "#22c55e",
    A: "#3b82f6",
    S: "#a855f7",
    SS: "#f59e0b",
  };
  return colors[grade];
}
