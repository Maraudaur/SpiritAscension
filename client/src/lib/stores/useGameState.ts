import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  PotentialGrade,
  BaseSpirit,
  GameState as GameStateData, // Import the main GameState type
  PlayerSpirit,
} from "@shared/types";
import spiritsDataJson from "@shared/data/spirits.json";
import { encrypt, decrypt } from "../encryption";

// --- From your original useGameState ---
export type FtueStep =
  | "highlightCultivation"
  | "highlightUpgradeBase"
  | "highlightSummon"
  | "highlightSummonButton"
  | null;

export type Spirit = BaseSpirit & {
  potential: PotentialGrade;
  level: number;
};

// --- Helper: Define Ascension Buffs ---
interface AscensionBuffs {
  qiMultiplier: number;
  battleMultiplier: number;
}

// --- Define the full store state ---
// This combines the data from types.ts with the FTUE state
export interface GameStateStore
  // --- FIX: Use Omit to remove the bad 'activeParty' before extending ---
  extends Omit<GameStateData, "activeParty"> {
  // FTUE State
  currentStoryNodeId: number | null;
  currentStoryDialogueIndex: number;
  ftueStep: FtueStep;
  hasUpgradedBase: boolean;

  // --- FIX: Add the correct 'activeParty' type ---
  activeParty: (string | null)[];

  ascensionTier: number;
  completedStoryNodes: number[];
  currentEncounterId: string | null;

  // Actions
  addQi: (amount: number) => void;
  purchaseUpgrade: (cost: number, rateIncrease: number) => boolean;
  addSpirit: (spiritId: string) => void;
  setParty: (party: (string | null)[]) => void; // This is the action
  isStoryNodeCompleted: (id: number) => boolean;
  completeStoryNode: (id: number) => void;
  setCurrentEncounterId: (id: string | null) => void;
  setStoryPosition: (nodeId: number | null, dialogueIndex: number) => void;
  setFtueStep: (step: FtueStep) => void;
  setHasUpgradedBase: (status: boolean) => void;

  // --- NEW ACTIONS REQUIRED BY MainScreen ---
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
}

// --- Ascension Constants (for placeholder logic) ---
const TIER_DATA = [
  { tier: 0, cost: 1000, qiMult: 1, battleMult: 0 },
  { tier: 1, cost: 10000, qiMult: 1.5, battleMult: 1 },
  { tier: 2, cost: 100000, qiMult: 2, battleMult: 2 },
  { tier: 3, cost: 1000000, qiMult: 2.5, battleMult: 3 },
  { tier: 4, cost: 10000000, qiMult: 3, battleMult: 4 },
  { tier: 5, cost: Infinity, qiMult: 5, battleMult: 5 },
];
const BASE_PROD_COST_BASE = 10;
const MULT_COST_BASE = 50;
const BATTLE_REWARD_COST_BASE = 100;

// --- Define the initial state based on types.ts ---
const initialState: GameStateData = {
  qi: 0,
  qiPerSecond: 1, // This will be calculated
  qiUpgrades: {
    baseProduction: 1,
    multiplier: 1,
    baseProductionLevel: 1,
    multiplierLevel: 1,
  },
  battleRewardMultiplier: 1, // Start at 100%
  spirits: [],
  activeParty: [], // Satisfy the strict 'string[]' type temporarily
  battlesWon: 0,
  lastUpdate: Date.now(),
  essences: {},
  summonCount: 0,
};

const POTENTIAL_BONUSES: { [key in PotentialGrade]: number } = {
  SS: 1.25,
  S: 1.2,
  A: 1.1,
  B: 1.05,
  C: 1,
};

// --- Cast the JSON data at import ---
const spiritsData: Record<string, BaseSpirit[]> = spiritsDataJson as any;

export const useGameState = create<GameStateStore>()(
  persist(
    immer((set, get) => ({
      // --- Spread the initial game state ---
      ...initialState,

      // --- Set the *actual* desired value for activeParty ---
      activeParty: [null, null, null],

      ascensionTier: 0,

      // --- FTUE State ---
      currentStoryNodeId: null,
      currentStoryDialogueIndex: 0,
      ftueStep: null,
      hasUpgradedBase: false,
      completedStoryNodes: [],
      currentEncounterId: null,

      // --- Actions ---
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
              elementalAffinity: "C",
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

      // --- THE ONLY 'setParty' DEFINITION ---
      setParty: (party: (string | null)[]) => {
        set({ activeParty: party }); // Use 'activeParty'
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

      resetGame: () => {
        set((state) => {
          Object.assign(state, {
            ...initialState,
            activeParty: [null, null, null], // Ensure reset uses correct type
            ascensionTier: 0,
            currentStoryNodeId: null,
            currentStoryDialogueIndex: 0,
            ftueStep: null,
            hasUpgradedBase: false,
            completedStoryNodes: [],
            currentEncounterId: null,
          });
        });
      },

      // --- MainScreen Actions ---
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
              state.ftueStep = null; // Clears the highlight
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
    })),
    // --- Encryption Config ---
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
    },
  ),
);

export { POTENTIAL_BONUSES };
