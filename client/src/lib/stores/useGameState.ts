import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  PotentialGrade,
  BaseSpirit,
  GameState as GameStateData,
  PlayerSpirit,
  Rarity,
} from "@shared/types";
import spiritsDataJson from "@shared/data/spirits.json";
import { encrypt, decrypt } from "../encryption";

// --- (FTUE, Spirit, AscensionBuffs types remain the same) ---
export type FtueStep =
  | "highlightCultivation"
  | "highlightUpgradeBase"
  | "highlightSummon"
  | "highlightSummonButton"
  | "highlightSpirits"
  | "highlightFirstSpirit"
  | "highlightLevelUpButton"
  | "highlightBattle"
  | null;

export type Spirit = BaseSpirit & {
  potential: PotentialGrade;
  level: number;
};

interface AscensionBuffs {
  qiMultiplier: number;
  battleMultiplier: number;
}

// Story battle checkpoint for retry flow
export interface StoryBattleCheckpoint {
  nodeId: number;
  dialogueIndex: number;
}

// --- Define the full store state ---
export interface GameStateStore extends Omit<GameStateData, "activeParty"> {
  // FTUE State
  currentStoryNodeId: number | null;
  currentStoryDialogueIndex: number;
  ftueStep: FtueStep;
  hasUpgradedBase: boolean;

  // Overrides
  activeParty: (string | null)[];

  // Other State
  ascensionTier: number;
  completedStoryNodes: number[];
  currentEncounterId: string | null;
  storyBattleCheckpoint: StoryBattleCheckpoint | null;

  // Debug State
  freeSummons: boolean;
  freeLevelUp: boolean;

  // Actions
  addQi: (amount: number) => void;
  purchaseUpgrade: (cost: number, rateIncrease: number) => boolean;
  addSpirit: (spiritId: string) => void;
  setParty: (party: (string | null)[]) => void;
  isStoryNodeCompleted: (id: number) => boolean;
  completeStoryNode: (id: number) => void;
  setCurrentEncounterId: (id: string | null) => void;
  setStoryPosition: (nodeId: number | null, dialogueIndex: number) => void;
  setFtueStep: (step: FtueStep) => void;
  setHasUpgradedBase: (status: boolean) => void;
  setStoryBattleCheckpoint: (checkpoint: StoryBattleCheckpoint | null) => void;
  resolveStoryBattle: (outcome: "victory" | "defeat") => void;

  // MainScreen Actions
  updateQi: () => void;
  upgradeQiProduction: () => void;
  upgradeQiMultiplier: () => void;
  getBaseProductionUpgradeCost: () => number;
  getMultiplierUpgradeCost: () => number;
  upgradeBattleReward: () => void;
  getBattleRewardUpgradeCost: () => number;
  getAscensionCost: () => number;
  getAscensionBuffs: (tier?: number) => AscensionBuffs;
  ascend: () => void;
  resetGame: () => void;

  // Summon Actions
  getSpiritCost: () => number;
  getMultiSummonCost: (count: number) => number;
  spendQi: (amount: number) => boolean;
  addEssence: (spiritId: string, amount: number) => void;
  summonSpirit: () => PlayerSpirit;
  summonMultipleSpirits: (count: number) => PlayerSpirit[];

  // SpiritManager Actions
  addToParty: (instanceId: string) => void;
  removeFromParty: (instanceId: string) => void;
  getEssenceCount: (spiritId: string) => number;
  getLevelUpCost: (level: number) => { qi: number; essence: number };
  levelUpSpirit: (instanceId: string) => void;
  harmonizeSpirit: (instanceId: string) => void;

  //Battle actions
  winBattle: (qiAmount: number) => void;
  updateSpiritHealth: (instanceId: string, health: number) => void;
  healAllSpirits: () => void;

  // Debug actions
  toggleFreeSummons: () => void;
  toggleFreeLevelUp: () => void;
  spawnSpecificSpirit: (spiritId: string) => PlayerSpirit | null;
}

// --- FIX: ALL CONSTANTS MOVED TO TOP-LEVEL SCOPE ---
const TIER_DATA = [
  { tier: 0, cost: 100000, qiMult: 1, battleMult: 0 },
  { tier: 1, cost: 1000000, qiMult: 1.5, battleMult: 1 },
  { tier: 2, cost: 10000000, qiMult: 2, battleMult: 2 },
  { tier: 3, cost: 100000000, qiMult: 2.5, battleMult: 3 },
  { tier: 4, cost: 1000000000, qiMult: 3, battleMult: 4 },
  { tier: 5, cost: Infinity, qiMult: 5, battleMult: 5 },
];
const BASE_PROD_COST_BASE = 10;
const MULT_COST_BASE = 50;
const BATTLE_REWARD_COST_BASE = 100;
const BASE_SUMMON_COST = 50; // <-- Now accessible

export const POTENTIAL_BONUSES: { [key in PotentialGrade]: number } = {
  SS: 1.25,
  S: 1.2,
  A: 1.1,
  B: 1.05,
  C: 1,
};

const POTENTIAL_GRADES: PotentialGrade[] = ["C", "B", "A", "S", "SS"];

const SUMMON_RATES: { rarity: Rarity; weight: number }[] = [
  { rarity: "common", weight: 600 },
  { rarity: "uncommon", weight: 250 },
  { rarity: "rare", weight: 100 },
  { rarity: "epic", weight: 40 },
  { rarity: "legendary", weight: 10 },
];
const TOTAL_WEIGHT = SUMMON_RATES.reduce((sum, rate) => sum + rate.weight, 0);
// --- END OF CONSTANTS ---

// --- Initial State ---
const initialState: GameStateData = {
  qi: 0,
  qiPerSecond: 1,
  qiUpgrades: {
    baseProduction: 1,
    multiplier: 1,
    baseProductionLevel: 1,
    multiplierLevel: 1,
  },
  battleRewardMultiplier: 1,
  spirits: [],
  activeParty: [],
  battlesWon: 0,
  lastUpdate: Date.now(),
  essences: {},
  summonCount: 0,
};

const spiritsData: Record<string, BaseSpirit[]> = spiritsDataJson as any;

// --- FIX: HELPER FUNCTIONS AT TOP-LEVEL SCOPE ---
// (These were correct, but now their constants are too)

function _selectRandomRarity(): Rarity {
  let roll = Math.random() * TOTAL_WEIGHT; // <-- Now works
  for (const rate of SUMMON_RATES) {
    // <-- Now works
    if (roll < rate.weight) {
      return rate.rarity;
    }
    roll -= rate.weight;
  }
  return "common"; // Fallback
}

function _createRandomSpirit(rarity: Rarity): PlayerSpirit {
  const spiritPool = spiritsData[rarity];
  if (!spiritPool || spiritPool.length === 0) {
    return _createRandomSpirit("common");
  }

  const baseSpirit = spiritPool[Math.floor(Math.random() * spiritPool.length)];
  const isPrismatic = Math.random() < 0.001; // 0.1% chance

  const getRandomPotential = (): PotentialGrade => {
    return POTENTIAL_GRADES[ // <-- Now works
      Math.floor(Math.random() * POTENTIAL_GRADES.length)
    ];
  };

  return {
    instanceId: crypto.randomUUID(),
    spiritId: baseSpirit.id,
    level: 1,
    experience: 0,
    isPrismatic: isPrismatic,
    potentialFactors: {
      attack: getRandomPotential(),
      defense: getRandomPotential(),
      health: getRandomPotential(),
      affinity: getRandomPotential(),
      agility: getRandomPotential(),
    },
  };
}

function _createSpecificSpirit(spiritId: string): PlayerSpirit | null {
  // Find the base spirit by ID across all rarities
  let baseSpirit: BaseSpirit | undefined = undefined;
  for (const raritySpirits of Object.values(spiritsData)) {
    baseSpirit = (raritySpirits as BaseSpirit[]).find((s) => s.id === spiritId);
    if (baseSpirit) break;
  }

  if (!baseSpirit) {
    console.error(`Spirit with ID "${spiritId}" not found`);
    return null;
  }

  const isPrismatic = Math.random() < 0.001; // 0.1% chance

  const getRandomPotential = (): PotentialGrade => {
    return POTENTIAL_GRADES[Math.floor(Math.random() * POTENTIAL_GRADES.length)];
  };

  return {
    instanceId: crypto.randomUUID(),
    spiritId: baseSpirit.id,
    level: 1,
    experience: 0,
    isPrismatic: isPrismatic,
    potentialFactors: {
      attack: getRandomPotential(),
      defense: getRandomPotential(),
      health: getRandomPotential(),
      affinity: getRandomPotential(),
      agility: getRandomPotential(),
    },
  };
}

// --- ZUSTAND STORE CREATION ---
export const useGameState = create<GameStateStore>()(
  persist(
    immer((set, get) => ({
      // --- (Initial State and FTUE State) ---
      ...initialState,
      activeParty: [null, null, null, null],
      ascensionTier: 0,
      currentStoryNodeId: null,
      currentStoryDialogueIndex: 0,
      ftueStep: null,
      hasUpgradedBase: false,
      completedStoryNodes: [],
      currentEncounterId: null,
      storyBattleCheckpoint: null,
      freeSummons: false,
      freeLevelUp: false,

      // --- (Core Actions) ---
      addQi: (amount: number) => {
        set((state) => {
          state.qi += amount;
        });
      },
      purchaseUpgrade: (cost: number, rateIncrease: number) => {
        if (get().qi >= cost) {
          set((state) => {
            state.qi -= cost;
            state.qiUpgrades.baseProduction += rateIncrease;
            if (!state.hasUpgradedBase) {
              state.hasUpgradedBase = true;
            }
            if (state.ftueStep === "highlightUpgradeBase") {
              state.ftueStep = null;
            }
          });
          return true;
        }
        return false;
      },
      addSpirit: (spiritId: string) => {
        // This function is for *giving* a spirit (e.g., from story)
        // not for random summoning.
        const allSpirits = Object.values(spiritsData).flat();
        const spirit = allSpirits.find((s) => s.id === spiritId);
        if (spirit) {
          const newPlayerSpirit: PlayerSpirit = {
            instanceId: crypto.randomUUID(),
            spiritId: spirit.id,
            level: 1,
            experience: 0,
            isPrismatic: false,
            potentialFactors: {
              attack: "C",
              defense: "C",
              health: "C",
              affinity: "C",
              agility: "C",
            },
          };
          set((state) => {
            state.spirits.push(newPlayerSpirit);
            if (state.ftueStep === "highlightSummonButton") {
              state.ftueStep = null;
            }
          });
        }
      },
      setParty: (party: (string | null)[]) => {
        set({ activeParty: party });
      },
      isStoryNodeCompleted: (id: number) => {
        return get().completedStoryNodes.includes(id);
      },
      completeStoryNode: (id: number) => {
        if (!get().isStoryNodeCompleted(id)) {
          set((state) => {
            state.completedStoryNodes.push(id);
          });
        }
      },
      setCurrentEncounterId: (id: string | null) => {
        set({ currentEncounterId: id });
      },
      setStoryPosition: (nodeId: number | null, dialogueIndex: number) => {
        set({
          currentStoryNodeId: nodeId,
          currentStoryDialogueIndex: dialogueIndex,
        });
      },
      setFtueStep: (step: FtueStep) => {
        set({ ftueStep: step });
      },
      setHasUpgradedBase: (status: boolean) => {
        set({ hasUpgradedBase: status });
      },
      setStoryBattleCheckpoint: (checkpoint: StoryBattleCheckpoint | null) => {
        set({ storyBattleCheckpoint: checkpoint });
      },
      resolveStoryBattle: (outcome: "victory" | "defeat") => {
        set((state) => {
          if (outcome === "victory") {
            // Mark story node complete on victory ONLY
            if (state.storyBattleCheckpoint) {
              const nodeId = state.storyBattleCheckpoint.nodeId;
              if (!state.completedStoryNodes.includes(nodeId)) {
                state.completedStoryNodes.push(nodeId);
              }
            }
            // Clear checkpoint and story position on victory
            state.storyBattleCheckpoint = null;
            state.currentStoryNodeId = null;
            state.currentStoryDialogueIndex = 0;
          } else {
            // On defeat, restore the checkpoint position (node stays incomplete)
            if (state.storyBattleCheckpoint) {
              state.currentStoryNodeId = state.storyBattleCheckpoint.nodeId;
              state.currentStoryDialogueIndex =
                state.storyBattleCheckpoint.dialogueIndex;
            }
          }
        });
      },
      resetGame: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            activeParty: [null, null, null, null],
            ascensionTier: 0,
            currentStoryNodeId: null,
            currentStoryDialogueIndex: 0,
            ftueStep: null,
            hasUpgradedBase: false,
            completedStoryNodes: [],
            currentEncounterId: null,
            storyBattleCheckpoint: null,
          });
        });
      },

      // --- (MainScreen Actions) ---
      updateQi: () => {
        const state = get();
        const buffs = state.getAscensionBuffs();
        const base = state.qiUpgrades.baseProduction;
        const multiplier = state.qiUpgrades.multiplier;
        const ascensionMultiplier = buffs.qiMultiplier;
        const battlesBonus = state.battlesWon * 0.01;
        const perSecond =
          (base * multiplier + battlesBonus) * ascensionMultiplier;
        const now = Date.now();
        const delta = (now - state.lastUpdate) / 1000;
        const qiToAdd = perSecond * delta;
        set((s) => {
          s.qi += qiToAdd;
          s.qiPerSecond = perSecond;
          s.lastUpdate = now;
        });
      },
      getBaseProductionUpgradeCost: () => {
        return Math.floor(
          BASE_PROD_COST_BASE *
            Math.pow(1.15, get().qiUpgrades.baseProductionLevel),
        );
      },
      getMultiplierUpgradeCost: () => {
        return Math.floor(
          MULT_COST_BASE * Math.pow(1.2, get().qiUpgrades.multiplierLevel),
        );
      },
      getBattleRewardUpgradeCost: () => {
        return Math.floor(
          BATTLE_REWARD_COST_BASE *
            Math.pow(1.25, get().battleRewardMultiplier / 0.1),
        );
      },
      upgradeQiProduction: () => {
        const cost = get().getBaseProductionUpgradeCost();
        if (get().qi >= cost) {
          set((state) => {
            state.qi -= cost;
            state.qiUpgrades.baseProduction += 1;
            state.qiUpgrades.baseProductionLevel += 1;
            if (!state.hasUpgradedBase) {
              state.hasUpgradedBase = true;
            }
            if (state.ftueStep === "highlightUpgradeBase") {
              state.ftueStep = null;
            }
          });
        }
      },
      upgradeQiMultiplier: () => {
        const cost = get().getMultiplierUpgradeCost();
        if (get().qi >= cost) {
          set((state) => {
            state.qi -= cost;
            state.qiUpgrades.multiplier += 0.1;
            state.qiUpgrades.multiplierLevel += 1;
          });
        }
      },
      upgradeBattleReward: () => {
        const cost = get().getBattleRewardUpgradeCost();
        if (get().qi >= cost) {
          set((state) => {
            state.qi -= cost;
            state.battleRewardMultiplier += 0.1;
          });
        }
      },
      getAscensionCost: () => {
        return TIER_DATA[get().ascensionTier]?.cost ?? Infinity;
      },
      getAscensionBuffs: (tier?: number) => {
        const currentTier = tier ?? get().ascensionTier;
        const data = TIER_DATA[currentTier];
        return {
          qiMultiplier: data?.qiMult ?? 1,
          battleMultiplier: data?.battleMult ?? 0,
        };
      },
      ascend: () => {
        const cost = get().getAscensionCost();
        if (get().qi >= cost) {
          set((state) => {
            state.qi = 0;
            state.battlesWon = 0;
            state.qiUpgrades = { ...initialState.qiUpgrades };
            state.battleRewardMultiplier = 1;
            state.summonCount = 0;
            state.lastUpdate = Date.now();
            state.ascensionTier += 1;
          });
        }
      },

      // --- SUMMONING LOGIC ---
      getSpiritCost: () => {
        const summonCount = get().summonCount ?? 0;
        // Exponential growth: 30% more expensive each summon
        const cost = BASE_SUMMON_COST * Math.pow(1.3, summonCount);
        // Clamp to safe integer range to prevent overflow
        return Math.floor(Math.min(cost, Number.MAX_SAFE_INTEGER));
      },

      getMultiSummonCost: (count: number) => {
        const summonCount = get().summonCount ?? 0;
        let totalCost = 0;
        // Calculate cost for each summon individually with exponential growth
        for (let i = 0; i < count; i++) {
          const cost = BASE_SUMMON_COST * Math.pow(1.3, summonCount + i);
          totalCost += Math.min(cost, Number.MAX_SAFE_INTEGER);
        }
        // Apply 10% discount for bulk summons
        return Math.floor(Math.min(totalCost * 0.9, Number.MAX_SAFE_INTEGER));
      },

      spendQi: (amount: number) => {
        // Free summons mode: always succeed without deducting Qi
        if (get().freeSummons) {
          return true;
        }
        
        if (get().qi >= amount) {
          set((state) => {
            state.qi -= amount;
          });
          return true;
        }
        return false;
      },

      addEssence: (spiritId: string, amount: number) => {
        set((state) => {
          const current = state.essences[spiritId] ?? 0;
          state.essences[spiritId] = current + amount;
        });
      },

      summonSpirit: () => {
        // Uses helper functions from top level
        const currentSummonCount = get().summonCount ?? 0;
        // First summon is always common
        const rarity = currentSummonCount === 0 ? "common" : _selectRandomRarity();
        const newSpirit = _createRandomSpirit(rarity);

        set((state) => {
          state.spirits.push(newSpirit);
          state.summonCount = (state.summonCount ?? 0) + 1;

          // FTUE logic
          if (state.ftueStep === "highlightSummonButton") {
            state.ftueStep = null;
          }
        });
        return newSpirit;
      },

      summonMultipleSpirits: (count: number) => {
        const newSpirits: PlayerSpirit[] = [];
        let hasRare = false;
        const currentSummonCount = get().summonCount ?? 0;

        for (let i = 0; i < count; i++) {
          // Uses helper functions from top level
          // First summon ever is always common
          const isFirstSummonEver = currentSummonCount === 0 && i === 0;
          const rarity = isFirstSummonEver ? "common" : _selectRandomRarity();
          if (["rare", "epic", "legendary"].includes(rarity)) {
            hasRare = true;
          }
          newSpirits.push(_createRandomSpirit(rarity));
        }

        // Guaranteed rare still applies even on first batch (just not in first slot if it's the first summon ever)
        if (!hasRare) {
          // If this is the very first summon batch, put the rare in the last slot (not first)
          newSpirits[count - 1] = _createRandomSpirit("rare");
        }

        set((state) => {
          state.spirits.push(...newSpirits);
          state.summonCount = (state.summonCount ?? 0) + count;
          if (state.ftueStep === "highlightSummonButton") {
            state.ftueStep = null;
          }
        });
        return newSpirits;
      },
      addToParty: (instanceId: string) => {
        set((state) => {
          // Find the first empty (null) slot
          const emptySlotIndex = state.activeParty.indexOf(null);
          if (emptySlotIndex !== -1) {
            // Add the spirit to that slot
            state.activeParty[emptySlotIndex] = instanceId;
          }
        });
      },

      removeFromParty: (instanceId: string) => {
        set((state) => {
          // Find the index of the spirit to remove
          const spiritIndex = state.activeParty.indexOf(instanceId);
          if (spiritIndex !== -1) {
            // Set that slot back to null
            state.activeParty[spiritIndex] = null;
          }
        });
      },

      getEssenceCount: (spiritId: string) => {
        return get().essences[spiritId] ?? 0;
      },

      getLevelUpCost: (level: number) => {
        const qiCost = Math.floor(10 * Math.pow(1.3, level));
        const essenceCost = 1 + Math.floor(level / 10);
        return { qi: qiCost, essence: essenceCost };
      },

      levelUpSpirit: (instanceId: string) => {
        const spirit = get().spirits.find((s) => s.instanceId === instanceId);
        if (!spirit) return;

        const cost = get().getLevelUpCost(spirit.level);
        const essenceCount = get().getEssenceCount(spirit.spiritId);
        const currentQi = get().qi;
        const freeLevelUp = get().freeLevelUp;

        // Check if we can afford it (or if free level up is enabled)
        if (freeLevelUp || (currentQi >= cost.qi && essenceCount >= cost.essence)) {
          set((state) => {
            // Find the spirit in the draft state to modify it
            const spiritToLevel = state.spirits.find(
              (s) => s.instanceId === instanceId,
            );
            if (spiritToLevel) {
              // Only deduct costs if not using free level up
              if (!freeLevelUp) {
                state.qi -= cost.qi;
                state.essences[spirit.spiritId] =
                  (state.essences[spirit.spiritId] ?? 0) - cost.essence;
              }
              spiritToLevel.level += 1;

              // FTUE logic: clear level up button highlight
              if (state.ftueStep === "highlightLevelUpButton") {
                state.ftueStep = null;
              }
            }
          });
        }
      },

      harmonizeSpirit: (instanceId: string) => {
        const spirit = get().spirits.find((s) => s.instanceId === instanceId);
        if (!spirit) return;

        const reward = 5 + spirit.level * 2;

        set((state) => {
          // Add essence
          state.essences[spirit.spiritId] =
            (state.essences[spirit.spiritId] ?? 0) + reward;

          // Remove from party if it's there
          if (state.activeParty.includes(instanceId)) {
            const index = state.activeParty.indexOf(instanceId);
            state.activeParty[index] = null;
          }

          // Remove from spirit list
          state.spirits = state.spirits.filter(
            (s) => s.instanceId !== instanceId,
          );
        });
      },
      winBattle: (qiAmount: number) => {
        set((state) => {
          state.qi += qiAmount;
          state.battlesWon += 1;

          // FTUE logic: clear battle highlight after winning
          if (state.ftueStep === "highlightBattle") {
            state.ftueStep = null;
          }
        });
      },

      updateSpiritHealth: (instanceId: string, health: number) => {
        set((state) => {
          const spirit = state.spirits.find((s) => s.instanceId === instanceId);
          if (spirit) {
            spirit.currentHealth = health;
          }
        });
      },

      healAllSpirits: () => {
        set((state) => {
          state.spirits.forEach((spirit) => {
            // Setting to undefined makes the battle logic
            // default them to max health on next battle start.
            spirit.currentHealth = undefined;
            spirit.activeEffects = []; // Clear effects
          });
        });
      },

      toggleFreeSummons: () => {
        set((state) => {
          state.freeSummons = !state.freeSummons;
        });
      },

      toggleFreeLevelUp: () => {
        set((state) => {
          state.freeLevelUp = !state.freeLevelUp;
        });
      },

      spawnSpecificSpirit: (spiritId: string) => {
        const newSpirit = _createSpecificSpirit(spiritId);
        if (newSpirit) {
          set((state) => {
            state.spirits.push(newSpirit);
          });
          return newSpirit;
        }
        return null;
      },
    })),
    // --- (Encryption Config) ---
    {
      name: "ascension-game-state",
      storage: createJSONStorage(() => ({
        setItem: (name, value) => {
          const encryptedState = encrypt(value);
          localStorage.setItem(name, encryptedState);
        },
        getItem: (name) => {
          const encryptedState = localStorage.getItem(name);
          if (!encryptedState) return null;
          try {
            const decryptedState = decrypt(encryptedState);
            return decryptedState;
          } catch (error) {
            console.warn("Failed to decrypt state, resetting save.", error);
            localStorage.removeItem(name);
            return null;
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      onRehydrateStorage: () => (state) => {
        // Migration: Fix activeParty if it has fewer than 4 slots
        if (state && state.activeParty && state.activeParty.length < 4) {
          console.log(`[Migration] Upgrading activeParty from ${state.activeParty.length} to 4 slots`);
          while (state.activeParty.length < 4) {
            state.activeParty.push(null);
          }
        }

        // Migration: Rename elementalAffinity to affinity
        if (state && state.spirits) {
          state.spirits.forEach((spirit: any) => {
            if (spirit.potentialFactors && 'elementalAffinity' in spirit.potentialFactors) {
              console.log(`[Migration] Renaming elementalAffinity to affinity for spirit ${spirit.instanceId}`);
              spirit.potentialFactors.affinity = spirit.potentialFactors.elementalAffinity;
              delete spirit.potentialFactors.elementalAffinity;
            }
          });
        }
      },
    },
  ),
);
