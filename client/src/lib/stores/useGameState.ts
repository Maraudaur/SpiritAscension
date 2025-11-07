import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  GameState,
  PlayerSpirit,
  Rarity,
  PotentialGrade,
} from "@shared/types";
import spiritsData from "@shared/data/spirits.json";
import { createJSONStorage } from "zustand/middleware";
import { encrypt, decrypt } from "../encryption";

const RARITY_CHANCES: Record<Rarity, number> = {
  common: 0.6,
  uncommon: 0.25,
  rare: 0.1,
  epic: 0.04,
  legendary: 0.01,
  boss: 0,
};

const PRISMATIC_CHANCE = 1 / 1024;

const POTENTIAL_CHANCES: { grade: PotentialGrade; chance: number }[] = [
  { grade: "C", chance: 0.4 },
  { grade: "B", chance: 0.3 },
  { grade: "A", chance: 0.2 },
  { grade: "S", chance: 0.08 },
  { grade: "SS", chance: 0.02 },
];

const POTENTIAL_BONUSES: Record<PotentialGrade, number> = {
  C: 0.03,
  B: 0.05,
  A: 0.07,
  S: 0.09,
  SS: 0.1,
};

const ASCENSION_COSTS = [
  50000, // Tier 0 -> 1
  200000, // Tier 1 -> 2
  400000, // Tier 2 -> 3
  800000, // Tier 3 -> 4
  2000000, // Tier 4 -> 5
];

const ASCENSION_BUFFS = [
  // Tier 0
  { qiMultiplier: 1, battleMultiplier: 0 },
  // Tier 1
  { qiMultiplier: 5, battleMultiplier: 0 },
  // Tier 2
  { qiMultiplier: 5, battleMultiplier: 0.2 },
  // Tier 3
  { qiMultiplier: 15, battleMultiplier: 0.2 },
  // Tier 4
  { qiMultiplier: 15, battleMultiplier: 0.6 },
  // Tier 5
  { qiMultiplier: 100, battleMultiplier: 0.6 },
];

function rollRarity(): Rarity {
  const roll = Math.random();
  let cumulative = 0;

  for (const [rarity, chance] of Object.entries(RARITY_CHANCES)) {
    cumulative += chance;
    if (roll < cumulative) {
      return rarity as Rarity;
    }
  }

  return "common";
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

  return "C";
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
  upgradeQiMultiplier: () => void; // NEW
  upgradeBattleReward: () => void;
  winBattle: (qiReward: number) => void;
  getSpiritCost: () => number;
  getBaseProductionUpgradeCost: () => number; // NEW
  getMultiplierUpgradeCost: () => number; // NEW
  getBattleRewardUpgradeCost: () => number;
  updateSpiritHealth: (instanceId: string, health: number) => void;
  levelUpSpirit: (instanceId: string) => void;
  addEssence: (spiritId: string, amount: number) => void;
  getEssenceCount: (spiritId: string) => number;
  harmonizeSpirit: (instanceId: string) => void;
  getLevelUpCost: (level: number) => { qi: number; essence: number };
  healAllSpirits: () => void;
  resetGame: () => void;
  ascensionTier: number;
  getAscensionCost: () => number;
  getAscensionBuffs: () => { qiMultiplier: number; battleMultiplier: number };
  ascend: () => void;
  getMultiSummonCost: (count: number) => number;
  summonMultipleSpirits: (count: number) => PlayerSpirit[];
  completedStoryNodes: number[];
  completeStoryNode: (nodeId: number) => void;
  isStoryNodeCompleted: (nodeId: number) => boolean;
  currentEncounterId: string | null;
  setCurrentEncounterId: (id: string | null) => void;
}

const BASE_SPIRIT_COST = 100;
// --- MODIFIED CONSTANTS ---
const BASE_PRODUCTION_UPGRADE_BASE_COST = 100; // Renamed and changed
const MULTIPLIER_UPGRADE_BASE_COST = 500; // NEW
const BATTLE_REWARD_UPGRADE_BASE_COST = 300;
// --------------------------
const getInitialState = () => ({
  qi: 1000,
  qiPerSecond: 1,
  qiUpgrades: {
    baseProduction: 1,
    baseProductionLevel: 1,
    multiplier: 1.0,
    multiplierLevel: 1,
  },
  battleRewardMultiplier: 1.0,
  spirits: [],
  activeParty: [],
  battlesWon: 0,
  lastUpdate: Date.now(),
  essences: {},
  summonCount: 0,
  ascensionTier: 0,
  completedStoryNodes: [],
  currentEncounterId: null,
});

export const useGameState = create<GameStore>()(
  persist(
    (set, get) => ({
      ...getInitialState(), // Use the initial state function

      updateQi: () => {
        const now = Date.now();
        const state = get();
        const timeDelta = (now - state.lastUpdate) / 1000;

        // --- MODIFIED: Include ascension buffs ---
        const { qiMultiplier, battleMultiplier } = get().getAscensionBuffs();
        const battleBonus = state.battlesWon * battleMultiplier;
        const totalMultiplier =
          (state.qiUpgrades.multiplier + battleBonus) * qiMultiplier;
        const qiPerSecond = state.qiUpgrades.baseProduction * totalMultiplier;
        // ----------------------------------------

        const qiGained = qiPerSecond * timeDelta;

        set({
          qi: state.qi + qiGained,
          qiPerSecond: qiPerSecond, // Ensure qiPerSecond is in sync
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
        const state = get();
        const cost = Math.floor(
          BASE_SPIRIT_COST * Math.pow(1.5, state.summonCount || 0),
        );
        return cost;
      },

      getMultiSummonCost: (count: number) => {
        const state = get();
        let totalCost = 0;
        const currentSummonCount = state.summonCount || 0;

        // This is the same formula used in getSpiritCost
        const costFormula = (summonIndex: number) =>
          Math.floor(BASE_SPIRIT_COST * Math.pow(1.5, summonIndex));

        for (let i = 0; i < count; i++) {
          totalCost += costFormula(currentSummonCount + i);
        }

        return totalCost;
      },

      getBaseProductionUpgradeCost: () => {
        const state = get();
        const level = state.qiUpgrades.baseProductionLevel;
        return Math.floor(
          BASE_PRODUCTION_UPGRADE_BASE_COST * Math.pow(1.1, level - 1),
        );
      },

      getMultiplierUpgradeCost: () => {
        const state = get();
        const level = state.qiUpgrades.multiplierLevel;
        return Math.floor(
          MULTIPLIER_UPGRADE_BASE_COST * Math.pow(1.1, level - 1),
        );
      },

      getBattleRewardUpgradeCost: () => {
        const state = get();
        const upgradeLevel = Math.round(
          (state.battleRewardMultiplier - 1.0) / 0.1,
        );
        return BATTLE_REWARD_UPGRADE_BASE_COST * (upgradeLevel + 1);
      },

      // --- NEW FUNCTION ---
      getAscensionCost: () => {
        const state = get();
        if (state.ascensionTier >= ASCENSION_COSTS.length) {
          return Infinity; // Max tier reached
        }
        return ASCENSION_COSTS[state.ascensionTier];
      },

      // --- NEW FUNCTION ---
      getAscensionBuffs: () => {
        const state = get();
        return (
          ASCENSION_BUFFS[state.ascensionTier] ||
          ASCENSION_BUFFS[ASCENSION_BUFFS.length - 1]
        );
      },
      // --------------------

      summonSpirit: () => {
        // This logic is now correct, with the other function removed
        const rarity = rollRarity();
        const spiritsOfRarity = spiritsData[rarity];
        const randomSpirit =
          spiritsOfRarity[Math.floor(Math.random() * spiritsOfRarity.length)];
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
          summonCount: (state.summonCount || 0) + 1,
        }));

        return newSpirit;
      }, // <-- This comma closes summonSpirit

      // --- THIS IS THE CORRECT, SEPARATE PLACEMENT ---
      summonMultipleSpirits: (count: number) => {
        const newSpirits: PlayerSpirit[] = [];

        for (let i = 0; i < count; i++) {
          // This logic is copied from your existing summonSpirit function
          const rarity = rollRarity();
          const spiritsOfRarity = spiritsData[rarity];
          const randomSpirit =
            spiritsOfRarity[Math.floor(Math.random() * spiritsOfRarity.length)];
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

          newSpirits.push(newSpirit);
        }

        // Set state ONCE for performance
        set((state) => ({
          spirits: [...state.spirits, ...newSpirits],
          summonCount: (state.summonCount || 0) + newSpirits.length,
        }));

        return newSpirits;
      },

      addToParty: (instanceId: string) => {
        // ... (unchanged)
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
        // ... (unchanged)
        set((state) => ({
          activeParty: state.activeParty.filter((id) => id !== instanceId),
        }));
      },

      upgradeQiProduction: () => {
        set((state) => {
          const cost = get().getBaseProductionUpgradeCost();
          if (state.qi >= cost) {
            const newBaseProduction = state.qiUpgrades.baseProduction + 1;

            // --- MODIFIED: Recalculate qiPerSecond ---
            const { qiMultiplier, battleMultiplier } =
              get().getAscensionBuffs();
            const battleBonus = state.battlesWon * battleMultiplier;
            const totalMultiplier =
              (state.qiUpgrades.multiplier + battleBonus) * qiMultiplier;
            const newQiPerSecond = newBaseProduction * totalMultiplier;
            // ----------------------------------------

            return {
              qi: state.qi - cost,
              qiUpgrades: {
                ...state.qiUpgrades,
                baseProduction: newBaseProduction,
                baseProductionLevel: state.qiUpgrades.baseProductionLevel + 1,
              },
              qiPerSecond: newQiPerSecond,
            };
          }
          return state;
        });
      },

      upgradeQiMultiplier: () => {
        set((state) => {
          const cost = get().getMultiplierUpgradeCost();
          if (state.qi >= cost) {
            const newMultiplier = parseFloat(
              (state.qiUpgrades.multiplier + 0.1).toFixed(1),
            );

            // --- MODIFIED: Recalculate qiPerSecond ---
            const { qiMultiplier, battleMultiplier } =
              get().getAscensionBuffs();
            const battleBonus = state.battlesWon * battleMultiplier;
            const totalMultiplier =
              (newMultiplier + battleBonus) * qiMultiplier;
            const newQiPerSecond =
              state.qiUpgrades.baseProduction * totalMultiplier;
            // ----------------------------------------

            return {
              qi: state.qi - cost,
              qiUpgrades: {
                ...state.qiUpgrades,
                multiplier: newMultiplier,
                multiplierLevel: state.qiUpgrades.multiplierLevel + 1,
              },
              qiPerSecond: newQiPerSecond,
            };
          }
          return state;
        });
      },

      upgradeBattleReward: () => {
        set((state) => {
          const cost = get().getBattleRewardUpgradeCost();
          if (state.qi >= cost) {
            return {
              ...state,
              qi: state.qi - cost,
              battleRewardMultiplier: parseFloat(
                (state.battleRewardMultiplier + 0.1).toFixed(1),
              ),
            };
          }
          return state;
        });
      },

      winBattle: (qiReward: number) => {
        set((state) => {
          const newMultiplier = parseFloat(
            (state.qiUpgrades.multiplier + 0.1).toFixed(1),
          );
          const newBattlesWon = state.battlesWon + 1;

          // --- MODIFIED: Recalculate qiPerSecond ---
          const { qiMultiplier, battleMultiplier } = get().getAscensionBuffs();
          const battleBonus = newBattlesWon * battleMultiplier; // Use new battle count
          const totalMultiplier = (newMultiplier + battleBonus) * qiMultiplier;
          const newQiPerSecond =
            state.qiUpgrades.baseProduction * totalMultiplier;
          // ----------------------------------------

          return {
            battlesWon: newBattlesWon,
            qi: state.qi + qiReward,
            qiUpgrades: {
              ...state.qiUpgrades,
              multiplier: newMultiplier,
            },
            qiPerSecond: newQiPerSecond,
          };
        });
      },

      // --- NEW FUNCTION ---
      ascend: () => {
        set((state) => {
          const cost = get().getAscensionCost();
          // Check for cost and max tier
          if (
            state.qi < cost ||
            state.ascensionTier >= ASCENSION_COSTS.length
          ) {
            return state;
          }

          const initialState = getInitialState();
          const newTier = state.ascensionTier + 1;
          const newBuffs = ASCENSION_BUFFS[newTier];

          // Calculate new qiPerSecond based on *reset* stats and *new* buffs
          const battleBonus =
            initialState.battlesWon * newBuffs.battleMultiplier; // Will be 0
          const totalMultiplier =
            (initialState.qiUpgrades.multiplier + battleBonus) *
            newBuffs.qiMultiplier;
          const newQiPerSecond =
            initialState.qiUpgrades.baseProduction * totalMultiplier;

          return {
            qi: state.qi - cost, // Deduct cost
            ascensionTier: newTier, // Increment tier

            // Reset progress
            qiUpgrades: initialState.qiUpgrades,
            battlesWon: initialState.battlesWon,
            summonCount: initialState.summonCount,

            // Set new Qi rate
            qiPerSecond: newQiPerSecond,

            // Keep spirits, essences, party, and battle mastery
            // (they are not part of initialState spread)
          };
        });
      },

      updateSpiritHealth: (instanceId: string, health: number) => {
        // ... (unchanged)
        set((state) => ({
          spirits: state.spirits.map((spirit) =>
            spirit.instanceId === instanceId
              ? { ...spirit, currentHealth: health }
              : spirit,
          ),
        }));
      },

      levelUpSpirit: (instanceId: string) => {
        // ... (unchanged)
        const state = get();
        const spirit = state.spirits.find((s) => s.instanceId === instanceId);
        if (!spirit) return;

        const cost = get().getLevelUpCost(spirit.level);
        const essenceCount = state.essences[spirit.spiritId] || 0;

        if (state.qi >= cost.qi && essenceCount >= cost.essence) {
          set((state) => ({
            qi: state.qi - cost.qi,
            essences: {
              ...state.essences,
              [spirit.spiritId]:
                (state.essences[spirit.spiritId] || 0) - cost.essence,
            },
            spirits: state.spirits.map((s) =>
              s.instanceId === instanceId
                ? { ...s, level: s.level + 1, experience: 0 }
                : s,
            ),
          }));
        }
      },

      addEssence: (spiritId: string, amount: number) => {
        // ... (unchanged)
        set((state) => ({
          essences: {
            ...state.essences,
            [spiritId]: (state.essences[spiritId] || 0) + amount,
          },
        }));
      },

      getEssenceCount: (spiritId: string) => {
        // ... (unchanged)
        const state = get();
        return state.essences[spiritId] || 0;
      },

      harmonizeSpirit: (instanceId: string) => {
        // ... (unchanged)
        const state = get();
        const spirit = state.spirits.find((s) => s.instanceId === instanceId);
        if (!spirit) return;

        const essenceGained = 5 + spirit.level * 2;

        set((state) => ({
          spirits: state.spirits.filter((s) => s.instanceId !== instanceId),
          activeParty: state.activeParty.filter((id) => id !== instanceId),
          essences: {
            ...state.essences,
            [spirit.spiritId]:
              (state.essences[spirit.spiritId] || 0) + essenceGained,
          },
        }));
      },

      getLevelUpCost: (level: number) => {
        // ... (unchanged)
        return {
          qi: level * 50,
          essence: level * 2,
        };
      },

      healAllSpirits: () => {
        // ... (unchanged)
        set((state) => ({
          spirits: state.spirits.map((spirit) => ({
            ...spirit,
            currentHealth: undefined,
          })),
        }));
      },
      completeStoryNode: (nodeId: number) => {
        set((state) => ({
          completedStoryNodes: state.completedStoryNodes.includes(nodeId)
            ? state.completedStoryNodes
            : [...state.completedStoryNodes, nodeId],
        }));
      },
      isStoryNodeCompleted: (nodeId: number) => {
        const state = get();
        return state.completedStoryNodes.includes(nodeId);
      },
      setCurrentEncounterId: (id) => set({ currentEncounterId: id }),
      resetGame: () => {
        set(getInitialState());
      },
    }),
    // --- THIS IS THE NEW, ENCRYPTED CONFIG ---
    {
      name: "ascension-game-state", // The name of the item in localStorage
      storage: createJSONStorage(() => ({
        /**
         * This function runs when SAVING the state.
         * We encrypt the 'value' (your game state) before saving.
         */
        setItem: (name, value) => {
          const encryptedState = encrypt(value);
          localStorage.setItem(name, encryptedState);
        },
        /**
         * This function runs when LOADING the state.
         * We load the encrypted data and try to decrypt it.
         */
        getItem: (name) => {
          const encryptedState = localStorage.getItem(name);
          // If no save exists, return null
          if (!encryptedState) return null;

          try {
            // Decrypt the state after loading
            const decryptedState = decrypt(encryptedState);
            return decryptedState;
          } catch (error) {
            console.warn("Failed to decrypt state, resetting save.", error);
            // If decryption fails (e.g., bad key, corrupt data),
            // remove the bad save file to start fresh.
            localStorage.removeItem(name);
            return null;
          }
        },
        /**
         * This function runs when DELETING the state.
         */
        removeItem: (name) => localStorage.removeItem(name),
      })),
    },
  ),
);

export { POTENTIAL_BONUSES };
