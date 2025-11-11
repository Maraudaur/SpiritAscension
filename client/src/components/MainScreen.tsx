import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";

export function CultivationScreen() {
  const ftueStep = useGameState((s) => s.ftueStep);
  const purchaseUpgrade = useGameState((s) => s.purchaseUpgrade); // Use the action from the store

  const handleEnhanceBase = () => {
    // The purchaseUpgrade action in the store
    // now automatically sets hasUpgradedBase = true
    purchaseUpgrade(10, 1); // Example cost/rate
  };

  const upgradeBaseClass =
    ftueStep === "highlightUpgradeBase" ? "animate-pulse-bright" : "";
}

interface MainScreenProps {
  onNavigate: (
    screen: "story" | "cultivation" | "spirits" | "summon" | "battle",
  ) => void;
}

const TIER_DATA = [
  { tier: 0, color: "#9CA3AF" }, // Grey
  { tier: 1, color: "#10B981" }, // Green
  { tier: 2, color: "#3B82F6" }, // Blue
  { tier: 3, color: "#A855F7" }, // Purple
  { tier: 4, color: "#F59E0B" }, // Orange/Legendary
  { tier: 5, color: "#E11D48" }, // Prismatic (using a bright red as placeholder)
];

export function MainScreen({ onNavigate }: MainScreenProps) {
  const {
    qi,
    qiPerSecond,
    updateQi,
    qiUpgrades,
    upgradeQiProduction,
    upgradeQiMultiplier,
    getBaseProductionUpgradeCost,
    getMultiplierUpgradeCost,
    battlesWon,
    battleRewardMultiplier,
    upgradeBattleReward,
    getBattleRewardUpgradeCost,
    resetGame,
    ascensionTier,
    getAscensionCost,
    getAscensionBuffs,
    ascend,
    activeParty,
  } = useGameState();

  const ftueStep = useGameState((s) => s.ftueStep);
  const [displayQi, setDisplayQi] = useState(qi);

  const [ascendConfirmStep, setAscendConfirmStep] = useState(0);

  useEffect(() => {
    setDisplayQi(qi);
  }, [qi]);

  // NEW: Get costs from the store
  const baseProductionUpgradeCost = getBaseProductionUpgradeCost();
  const canUpgradeBaseProduction = qi >= baseProductionUpgradeCost;

  const multiplierUpgradeCost = getMultiplierUpgradeCost();
  const canUpgradeMultiplier = qi >= multiplierUpgradeCost;

  const battleRewardUpgradeCost = getBattleRewardUpgradeCost();
  const canUpgradeBattleReward = qi >= battleRewardUpgradeCost;

  const ascensionCost = getAscensionCost();
  const canAscend = qi >= ascensionCost;
  const currentAscensionBuffs = getAscensionBuffs();
  const currentTierData = TIER_DATA[ascensionTier] || TIER_DATA[0];
  const isPrismatic = ascensionTier === 5; // Special class for max tier
  const progressPercent = Math.min((qi / ascensionCost) * 100, 100);

  const handleResetGame = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all game progress? This cannot be undone.",
      )
    ) {
      console.log("--- RESETTING GAME ---");
      // 1. Call the store's reset function.
      // This will reset the in-memory state AND
      // trigger persist() to overwrite localStorage.
      resetGame();

      console.log("In-memory state reset. Reloading page...");

      // 2. Reload the page to force all components to use the new state.
      window.location.reload();
    }
  };

  // --- MODIFIED: Ascension Handler ---
  // Now just opens the modal
  const handleAscendClick = () => {
    if (!canAscend) return;
    setAscendConfirmStep(1);
  };

  // This function handles the final confirmation
  const executeAscension = () => {
    ascend();
    setAscendConfirmStep(0);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="w-full h-full flex flex-col gap-4 p-6 overflow-y-auto"
        style={{ background: "#F5E6D3" }}
      >
        {/* Three-Column Grid */}
        <div className="flex-1 grid grid-cols-3 gap-4">
          {/* LEFT COLUMN: Ascension */}
          <div className="flex flex-col gap-4">
            <div className="p-4 parchment-bg rounded border-2 border-amber-700 flex flex-col">
              <h3 className="text-lg font-bold parchment-text mb-3">
                Ascension
              </h3>

              {/* Tier Display */}
              <div className="flex items-center gap-2 mb-3">
                <Star
                  className={isPrismatic ? "prismatic-text-fill" : ""}
                  style={{
                    color: isPrismatic ? undefined : currentTierData.color,
                  }}
                  size={28}
                  fill={
                    isPrismatic
                      ? "url(#prismatic-gradient)"
                      : currentTierData.color
                  }
                />
                <span className="text-xl font-bold parchment-text">
                  Tier {ascensionTier}
                </span>
              </div>

              {/* Buffs Display */}
              <div className="parchment-text text-sm mb-3 space-y-1">
                {currentAscensionBuffs.qiMultiplier > 1 && (
                  <div className="flex justify-between">
                    <span>Qi Multiplier:</span>
                    <span className="font-semibold">
                      {currentAscensionBuffs.qiMultiplier}x
                    </span>
                  </div>
                )}
                {currentAscensionBuffs.battleMultiplier > 0 && (
                  <div className="flex justify-between">
                    <span>Battle Win Bonus:</span>
                    <span className="font-semibold">
                      +{currentAscensionBuffs.battleMultiplier}x
                    </span>
                  </div>
                )}
                {currentAscensionBuffs.qiMultiplier <= 1 &&
                  currentAscensionBuffs.battleMultiplier <= 0 && (
                    <span className="opacity-75">No buffs at this tier.</span>
                  )}
              </div>

              {/* Progress Bar */}
              {ascensionTier < TIER_DATA.length - 1 ? (
                <>
                  <div className="w-full bg-gray-300 rounded-full h-2.5 mb-1 border border-gray-400">
                    <div
                      className="bg-blue-600 h-full rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-xs parchment-text text-center mb-3">
                    {Math.floor(qi)} / {ascensionCost} Qi
                  </p>

                  {/* Ascend Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleAscendClick}
                        disabled={!canAscend}
                        className="w-full mt-auto transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        style={{
                          background: canAscend ? "var(--azure)" : "#999",
                          color: "var(--parchment)",
                          boxShadow: canAscend
                            ? "0 4px 6px rgba(58, 110, 165, 0.4)"
                            : "none",
                        }}
                      >
                        Ascend (Cost: {ascensionCost} Qi)
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="parchment-bg border-2 border-amber-700">
                      <p className="parchment-text text-xs">
                        Ascend to next tier for enhanced buffs!
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <p className="font-bold parchment-text text-center my-4">
                  You have reached the final Ascension!
                </p>
              )}

              {/* Description */}
              <p className="text-xs parchment-text opacity-75 italic mt-3">
                When you ascend you lose all Cultivation progress (Base,
                Multiplier, Battles Won). Summon cost resets. You keep spirits
                and gain a new Ascension buff.
              </p>
            </div>
          </div>

          {/* MIDDLE COLUMN: Basic Generators */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold parchment-text">
              Basic Generators
            </h2>

            {/* Qi Upgrades */}
            <div className="p-4 parchment-bg rounded border-2 border-amber-700">
              <h3 className="text-lg font-bold parchment-text mb-3">
                Qi Upgrades
              </h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between parchment-text text-sm">
                  <span>Base Production:</span>
                  <span className="font-semibold">
                    {qiUpgrades.baseProduction}
                  </span>
                </div>
                <div className="flex justify-between parchment-text text-sm">
                  <span>Multiplier:</span>
                  <span className="font-semibold">
                    {qiUpgrades.multiplier.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between parchment-text text-sm">
                  <span>Battles Won:</span>
                  <span className="font-semibold">{battlesWon}</span>
                </div>
              </div>

              {/* Button 1: Base Production */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={upgradeQiProduction}
                    disabled={!canUpgradeBaseProduction}
                    className={`w-full mt-4 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none ${
                      ftueStep === "highlightUpgradeBase"
                        ? "animate-pulse-bright"
                        : ""
                    }`}
                    style={{
                      background: canUpgradeBaseProduction
                        ? "var(--vermillion)"
                        : "#999",
                      color: "var(--parchment)",
                      boxShadow: canUpgradeBaseProduction
                        ? "0 4px 6px rgba(193, 39, 45, 0.3)"
                        : "none",
                    }}
                  >
                    Enhance Base ({baseProductionUpgradeCost} Qi)
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="parchment-bg border-2 border-amber-700">
                  <p className="parchment-text text-xs">
                    Current: {qiUpgrades.baseProduction} → Next:{" "}
                    {qiUpgrades.baseProduction + 1}
                  </p>
                </TooltipContent>
              </Tooltip>

              {/* Button 2: Multiplier */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={upgradeQiMultiplier}
                    disabled={!canUpgradeMultiplier}
                    className="w-full mt-4 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    style={{
                      background: canUpgradeMultiplier
                        ? "var(--vermillion)"
                        : "#999",
                      color: "var(--parchment)",
                      boxShadow: canUpgradeMultiplier
                        ? "0 4px 6px rgba(193, 39, 45, 0.3)"
                        : "none",
                    }}
                  >
                    Amplify Multiplier ({multiplierUpgradeCost} Qi)
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="parchment-bg border-2 border-amber-700">
                  <p className="parchment-text text-xs">
                    Current: {qiUpgrades.multiplier.toFixed(1)}x → Next:{" "}
                    {(qiUpgrades.multiplier + 0.1).toFixed(1)}x
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Battle Mastery */}
            <div className="p-4 parchment-bg rounded border-2 border-amber-700">
              <h3 className="text-lg font-bold parchment-text mb-3">
                Battle Mastery
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between parchment-text text-sm">
                  <span>Battle Reward Multiplier:</span>
                  <span className="font-semibold">
                    {(battleRewardMultiplier * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs parchment-text opacity-75 italic">
                  Each upgrade increases battle Qi rewards by 10%
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={upgradeBattleReward}
                    disabled={!canUpgradeBattleReward}
                    className="w-full mt-4 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    style={{
                      background: canUpgradeBattleReward
                        ? "var(--vermillion)"
                        : "#999",
                      color: "var(--parchment)",
                      boxShadow: canUpgradeBattleReward
                        ? "0 4px 6px rgba(193, 39, 45, 0.3)"
                        : "none",
                    }}
                  >
                    Enhance Battle Mastery ({battleRewardUpgradeCost} Qi)
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="parchment-bg border-2 border-amber-700">
                  <p className="parchment-text text-xs">
                    Current: {(battleRewardMultiplier * 100).toFixed(0)}% →
                    Next: {((battleRewardMultiplier + 0.1) * 100).toFixed(0)}%
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* RIGHT COLUMN: Advanced Generators */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold parchment-text">
              Advanced Generators
            </h2>

            {/* Coming Soon Placeholder */}
            <div className="p-8 parchment-bg rounded border-2 border-amber-700 flex items-center justify-center">
              <p className="text-lg parchment-text opacity-75 italic">
                Coming Soon...
              </p>
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <Button
          onClick={handleResetGame}
          variant="destructive"
          className="w-full p-4"
        >
          <span className="text-sm font-semibold">RESET GAME (DEBUG)</span>
        </Button>
      </div>

      {/* Ascension Confirmation Modal */}
      <AnimatePresence>
        {ascendConfirmStep > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="parchment-bg chinese-border p-8 rounded-lg max-w-md w-full"
            >
              <h3 className="text-2xl font-bold parchment-text mb-4 text-center brush-stroke">
                {ascendConfirmStep === 1 ? "Ascend?" : "Final Confirmation"}
              </h3>
              {ascendConfirmStep === 1 && (
                <p className="text-base parchment-text mb-6 text-center">
                  Are you sure you want to Ascend? You will lose all...
                  (description text)
                </p>
              )}
              {ascendConfirmStep === 2 && (
                <p className="text-base parchment-text mb-6 text-center font-semibold text-red-700">
                  FINAL CONFIRMATION: Ascend to the next tier? This...
                  (description text)
                </p>
              )}
              <div className="flex gap-4">
                <Button
                  onClick={() => setAscendConfirmStep(0)}
                  className="flex-1 p-3 text-base"
                  variant="outline"
                  style={{ background: "#EEE", color: "#333" }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (ascendConfirmStep === 1) {
                      setAscendConfirmStep(2);
                    } else {
                      executeAscension();
                    }
                  }}
                  className="flex-1 p-3 text-base"
                  style={{
                    background: "var(--jade-green)",
                    color: "var(--parchment)",
                  }}
                >
                  {ascendConfirmStep === 1 ? "Ascend" : "Confirm"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
