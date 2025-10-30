import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameState, PlayerSpirit, Rarity, PotentialGrade } from '@shared/types';
import spiritsData from '@shared/data/spirits.json';

const RARITY_CHANCES: Record<Rarity, number> = {
  common: 0.60,
  uncommon: 0.25,
  rare: 0.10,
  epic: 0.04,
  legendary: 0.01,
};

const PRISMATIC_CHANCE = 1 / 1024;

const POTENTIAL_CHANCES: { grade: PotentialGrade; chance: number }[] = [
  { grade: 'C', chance: 0.40 },
  { grade: 'B', chance: 0.30 },
  { grade: 'A', chance: 0.20 },
  { grade: 'S', chance: 0.08 },
  { grade: 'SS', chance: 0.02 },
];

const POTENTIAL_BONUSES: Record<PotentialGrade, number> = {
  C: 0.03,
  B: 0.05,
  A: 0.07,
  S: 0.09,
  SS: 0.10,
};

function rollRarity(): Rarity {
  const roll = Math.random();
  let cumulative = 0;
  
  for (const [rarity, chance] of Object.entries(RARITY_CHANCES)) {
    cumulative += chance;
    if (roll < cumulative) {
      return rarity as Rarity;
    }
  }
  
  return 'common';
}

function rollPotentialGrade(): PotentialGrade {
  const roll = Math.random();
  let cumulative = 0;
  
  for (const { grade, chance } of POTENTIAL_CHANCES) {
    cumulative += chance;
    if (roll < cumulative) {
      return grade;
    }
  }
  
  return 'C';
}

function rollPrismatic(): boolean {
  return Math.random() < PRISMATIC_CHANCE;
}

interface GameStore extends GameState {
  summonSpirit: () => PlayerSpirit;
  addToParty: (instanceId: string) => void;
  removeFromParty: (instanceId: string) => void;
  updateQi: () => void;
  addQi: (amount: number) => void;
  spendQi: (amount: number) => boolean;
  upgradeQiProduction: () => void;
  upgradeBattleReward: () => void;
  winBattle: (qiReward: number) => void;
  getSpiritCost: () => number;
  getBattleRewardUpgradeCost: () => number;
  updateSpiritHealth: (instanceId: string, health: number) => void;
  levelUpSpirit: (instanceId: string) => void;
  addEssence: (spiritId: string, amount: number) => void;
  getEssenceCount: (spiritId: string) => number;
  harmonizeSpirit: (instanceId: string) => void;
  getLevelUpCost: (level: number) => { qi: number; essence: number };
}

const BASE_SPIRIT_COST = 100;
const QI_UPGRADE_BASE_COST = 500;
const BATTLE_REWARD_UPGRADE_BASE_COST = 300;

export const useGameState = create<GameStore>()(
  persist(
    (set, get) => ({
      qi: 1000,
      qiPerSecond: 1,
      qiUpgrades: {
        baseProduction: 1,
        multiplier: 1,
      },
      battleRewardMultiplier: 1.0,
      spirits: [],
      activeParty: [],
      battlesWon: 0,
      lastUpdate: Date.now(),
      essences: {},

      updateQi: () => {
        const now = Date.now();
        const state = get();
        const timeDelta = (now - state.lastUpdate) / 1000;
        const qiGained = state.qiPerSecond * timeDelta;
        
        set({
          qi: state.qi + qiGained,
          lastUpdate: now,
        });
      },

      addQi: (amount: number) => {
        set((state) => ({ qi: state.qi + amount }));
      },

      spendQi: (amount: number) => {
        const state = get();
        if (state.qi >= amount) {
          set({ qi: state.qi - amount });
          return true;
        }
        return false;
      },

      getSpiritCost: () => {
        return BASE_SPIRIT_COST;
      },

      getBattleRewardUpgradeCost: () => {
        const state = get();
        const upgradeLevel = Math.floor((state.battleRewardMultiplier - 1.0) / 0.1);
        return BATTLE_REWARD_UPGRADE_BASE_COST * (upgradeLevel + 1);
      },

      summonSpirit: () => {
        const rarity = rollRarity();
        const spiritsOfRarity = spiritsData[rarity];
        const randomSpirit = spiritsOfRarity[Math.floor(Math.random() * spiritsOfRarity.length)];
        const isPrismatic = rollPrismatic();
        
        const potentialFactors = {
          attack: rollPotentialGrade(),
          defense: rollPotentialGrade(),
          health: rollPotentialGrade(),
          elementalAffinity: rollPotentialGrade(),
        };

        const instanceId = `${randomSpirit.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newSpirit: PlayerSpirit = {
          instanceId,
          spiritId: randomSpirit.id,
          level: 1,
          experience: 0,
          isPrismatic,
          potentialFactors,
        };

        set((state) => ({
          spirits: [...state.spirits, newSpirit],
        }));

        return newSpirit;
      },

      addToParty: (instanceId: string) => {
        set((state) => {
          if (state.activeParty.length >= 4) {
            return state;
          }
          if (state.activeParty.includes(instanceId)) {
            return state;
          }
          return {
            activeParty: [...state.activeParty, instanceId],
          };
        });
      },

      removeFromParty: (instanceId: string) => {
        set((state) => ({
          activeParty: state.activeParty.filter(id => id !== instanceId),
        }));
      },

      upgradeQiProduction: () => {
        set((state) => {
          const cost = QI_UPGRADE_BASE_COST * (state.qiUpgrades.baseProduction + 1);
          if (state.qi >= cost) {
            const newBaseProduction = state.qiUpgrades.baseProduction + 1;
            const newMultiplier = state.qiUpgrades.multiplier + (state.battlesWon * 0.1);
            return {
              qi: state.qi - cost,
              qiUpgrades: {
                baseProduction: newBaseProduction,
                multiplier: newMultiplier,
              },
              qiPerSecond: newBaseProduction * newMultiplier,
            };
          }
          return state;
        });
      },

      upgradeBattleReward: () => {
        set((state) => {
          const upgradeLevel = Math.floor((state.battleRewardMultiplier - 1.0) / 0.1);
          const cost = BATTLE_REWARD_UPGRADE_BASE_COST * (upgradeLevel + 1);
          if (state.qi >= cost) {
            return {
              ...state,
              qi: state.qi - cost,
              battleRewardMultiplier: state.battleRewardMultiplier + 0.1,
            };
          }
          return state;
        });
      },

      winBattle: (qiReward: number) => {
        set((state) => {
          return {
            battlesWon: state.battlesWon + 1,
            qi: state.qi + qiReward,
            qiUpgrades: {
              ...state.qiUpgrades,
              multiplier: state.qiUpgrades.multiplier + 0.1,
            },
            qiPerSecond: state.qiUpgrades.baseProduction * (state.qiUpgrades.multiplier + 0.1),
          };
        });
      },

      updateSpiritHealth: (instanceId: string, health: number) => {
        set((state) => ({
          spirits: state.spirits.map(spirit =>
            spirit.instanceId === instanceId
              ? { ...spirit, currentHealth: health }
              : spirit
          ),
        }));
      },

      levelUpSpirit: (instanceId: string) => {
        const state = get();
        const spirit = state.spirits.find(s => s.instanceId === instanceId);
        if (!spirit) return;

        const cost = get().getLevelUpCost(spirit.level);
        const essenceCount = state.essences[spirit.spiritId] || 0;

        if (state.qi >= cost.qi && essenceCount >= cost.essence) {
          set((state) => ({
            qi: state.qi - cost.qi,
            essences: {
              ...state.essences,
              [spirit.spiritId]: (state.essences[spirit.spiritId] || 0) - cost.essence,
            },
            spirits: state.spirits.map(s =>
              s.instanceId === instanceId
                ? { ...s, level: s.level + 1, experience: 0 }
                : s
            ),
          }));
        }
      },

      addEssence: (spiritId: string, amount: number) => {
        set((state) => ({
          essences: {
            ...state.essences,
            [spiritId]: (state.essences[spiritId] || 0) + amount,
          },
        }));
      },

      getEssenceCount: (spiritId: string) => {
        const state = get();
        return state.essences[spiritId] || 0;
      },

      harmonizeSpirit: (instanceId: string) => {
        const state = get();
        const spirit = state.spirits.find(s => s.instanceId === instanceId);
        if (!spirit) return;

        const essenceGained = 5 + (spirit.level * 2);

        set((state) => ({
          spirits: state.spirits.filter(s => s.instanceId !== instanceId),
          activeParty: state.activeParty.filter(id => id !== instanceId),
          essences: {
            ...state.essences,
            [spirit.spiritId]: (state.essences[spirit.spiritId] || 0) + essenceGained,
          },
        }));
      },

      getLevelUpCost: (level: number) => {
        return {
          qi: level * 50,
          essence: level * 2,
        };
      },
    }),
    {
      name: 'ascension-game-state',
    }
  )
);

export { POTENTIAL_BONUSES };
