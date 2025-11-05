import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  Sparkles,
  Swords,
  Users,
  Volume2,
  VolumeX,
  Star,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getRarityColor } from "@/lib/spiritUtils";
import { motion, AnimatePresence } from "framer-motion";
import { SummonScreen } from "./SummonScreen";

interface MainScreenProps {
  onNavigate: (
    screen: "main" | "spirits" | "battle" | "summon" | "boss",
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
    upgradeQiProduction, // Assumes this now ONLY upgrades base production
    upgradeQiMultiplier, // NEW: You must add this function to useGameState
    getBaseProductionUpgradeCost, // NEW: You must add this
    getMultiplierUpgradeCost, // NEW: You must add this
    battlesWon,
    battleRewardMultiplier,
    upgradeBattleReward,
    getBattleRewardUpgradeCost,
    resetGame,
    ascensionTier,
    getAscensionCost,
    getAscensionBuffs,
    ascend,
    getSpiritCost,
    getMultiSummonCost,
    activeParty,
  } = useGameState();
  const { isMuted, toggleMute, volume, setVolume } = useAudio();
  const [displayQi, setDisplayQi] = useState(qi);
  const [isClient, setIsClient] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  useEffect(() => {
    console.log(
      "DEBUG (MainScreen): Component Mounted. Setting isClient to true.",
    );
    setIsClient(true);
  }, []);

  const canEnterBattle = isClient && activeParty && activeParty.length > 0;

  // 0 = hidden, 1 = first warning, 2 = final warning
  const [ascendConfirmStep, setAscendConfirmStep] = useState(0);
  const [showSummonRates, setShowSummonRates] = useState(false);
  const [summonRequest, setSummonRequest] = useState<number | null>(null);

  // --- DEBUG: Log state on every render ---
  console.log("--- MainScreen Render ---");
  console.log("isClient:", isClient);
  console.log("activeParty:", JSON.stringify(activeParty)); // Stringify to see the array contents
  console.log("canEnterBattle:", canEnterBattle);
  console.log("-------------------------");
  // --- END DEBUG ---

  useEffect(() => {
    const interval = setInterval(() => {
      updateQi();
    }, 100);

    return () => clearInterval(interval);
  }, [updateQi]);

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

  // --- NEW: Summoning Costs ---
  const spiritCost = getSpiritCost();
  const canSummonOne = qi >= spiritCost;
  // This new function calculates the total cost for 10 summons
  const multiSummonCost = getMultiSummonCost(10);
  const canSummonTen = qi >= multiSummonCost;

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
    <div className="w-full min-h-screen flex flex-col items-center p-4 relative">
      <div className="parchment-bg chinese-border max-w-2xl w-full p-8 rounded-lg relative">
        {/* Volume button in top-right corner of main area */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            title="Volume Control"
            className="bg-white/90 backdrop-blur-sm"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </Button>
          
          {/* Volume Slider Popup */}
          <AnimatePresence>
            {showVolumeSlider && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-14 right-0 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border-2 border-amber-700"
                style={{ width: "200px" }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold parchment-text">Volume</span>
                    <span className="text-xs parchment-text">{volume}%</span>
                  </div>
                  <Slider
                    value={[volume]}
                    onValueChange={(values) => setVolume(values[0])}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleMute}
                    className="w-full text-xs"
                  >
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <h1 className="text-5xl font-bold text-center mb-2 parchment-text brush-stroke">
          天道修真
        </h1>
        <p className="text-2xl text-center mb-8 parchment-text">Ascension</p>

        <div className="mb-8 p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg chinese-border flex gap-4">
          <div className="qi-sprite flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl parchment-text font-bold">
                Qi Energy
              </span>
              <span
                className="text-3xl font-bold qi-glow"
                style={{ color: "var(--imperial-gold)" }}
              >
                {Math.floor(displayQi)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm parchment-text opacity-75">
                Generation Rate
              </span>
              <span className="text-lg parchment-text font-semibold">
                {qiPerSecond.toFixed(1)} / sec
              </span>
            </div>
          </div>
        </div>

        {/* --- MODIFIED LAYOUT: Wrapped Cultivation and Ascension in a Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* --- Block 1: Cultivation Progress (Existing) --- */}
          <div className="p-4 parchment-bg rounded border-2 border-amber-700">
            <h3 className="text-lg font-bold parchment-text mb-3">
              Cultivation Progress
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
            <Button
              onClick={upgradeQiProduction}
              disabled={!canUpgradeBaseProduction}
              className="w-full mt-4"
              style={{
                background: canUpgradeBaseProduction
                  ? "var(--vermillion)"
                  : "#999",
                color: "var(--parchment)",
              }}
            >
              Enhance Base ({baseProductionUpgradeCost} Qi)
            </Button>

            {/* Button 2: Multiplier */}
            <Button
              onClick={upgradeQiMultiplier}
              disabled={!canUpgradeMultiplier}
              className="w-full mt-4"
              style={{
                background: canUpgradeMultiplier ? "var(--vermillion)" : "#999",
                color: "var(--parchment)",
              }}
            >
              Amplify Multiplier ({multiplierUpgradeCost} Qi)
            </Button>
          </div>

          {/* --- Block 2: Ascension (NEW) --- */}
          <div className="p-4 parchment-bg rounded border-2 border-amber-700 flex flex-col">
            <h3 className="text-lg font-bold parchment-text mb-3">Ascension</h3>

            {/* Tier Display */}
            <div className="flex items-center gap-2 mb-3">
              <Star
                className={isPrismatic ? "prismatic-text-fill" : ""} // Assumes you have a CSS class for this
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
                <Button
                  onClick={handleAscendClick}
                  disabled={!canAscend}
                  className="w-full mt-auto"
                  style={{
                    background: canAscend ? "var(--azure)" : "#999",
                    color: "var(--parchment)",
                  }}
                >
                  Ascend (Cost: {ascensionCost} Qi)
                </Button>
              </>
            ) : (
              <p className="font-bold parchment-text text-center my-4">
                You have reached the final Ascension!
              </p>
            )}

            {/* Description */}
            <p className="text-xs parchment-text opacity-75 italic mt-3">
              When you ascend you lose all Cultivation progress (Base,
              Multiplier, Battles Won). Summon cost resets. You keep spirits and
              gain a new Ascension buff.
            </p>
          </div>
        </div>
        {/* --- END GRID WRAPPER --- */}
        {/* --- MODIFIED: Battle Mastery & Summoning Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Block 1: Battle Mastery */}
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
            <Button
              onClick={upgradeBattleReward}
              disabled={!canUpgradeBattleReward}
              className="w-full mt-4"
              style={{
                background: canUpgradeBattleReward
                  ? "var(--vermillion)"
                  : "#999",
                color: "var(--parchment)",
              }}
            >
              Enhance Battle Mastery ({battleRewardUpgradeCost} Qi)
            </Button>
          </div>

          {/* Block 2: Spirit Summoning (NEW) */}
          <div className="p-4 parchment-bg rounded border-2 border-amber-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold parchment-text">
                Spirit Summoning
              </h3>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setShowSummonRates(!showSummonRates)}
                className="bg-white/80"
              >
                <Info size={18} />
              </Button>
            </div>

            {showSummonRates ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm parchment-text">
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor("common") }}>
                      Common:
                    </span>
                    <span>60%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor("uncommon") }}>
                      Uncommon:
                    </span>
                    <span>25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor("rare") }}>Rare:</span>
                    <span>10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor("epic") }}>Epic:</span>
                    <span>4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor("legendary") }}>
                      Legendary:
                    </span>
                    <span>1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="prismatic-border px-1 rounded">
                      Prismatic:
                    </span>
                    <span>0.1%</span>
                  </div>
                </div>
              </motion.div>
            ) : null}

            <div className="space-y-3">
              <Button
                onClick={() => setSummonRequest(1)} // Opens modal
                disabled={!canSummonOne}
                className="w-full p-5 text-base font-bold"
                style={{
                  background: canSummonOne ? "var(--jade-green)" : "#999",
                  color: "var(--parchment)",
                }}
              >
                Summon Spirit ({spiritCost} Qi)
              </Button>
              {/* --- CHANGED: onClick handler --- */}
              <Button
                onClick={() => setSummonRequest(10)} // Opens modal
                disabled={!canSummonTen}
                className="w-full p-5 text-base font-bold"
                style={{
                  background: canSummonTen ? "var(--jade-green)" : "#999",
                  color: "var(--parchment)",
                }}
              >
                Summon 10 Spirits ({multiSummonCost} Qi)
              </Button>
            </div>
          </div>
        </div>

        {/* --- MODIFIED: Navigation Buttons (2-col) --- */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Button
            onClick={() => onNavigate("spirits")}
            className="p-6 flex flex-col items-center gap-2"
            style={{ background: "var(--azure)", color: "var(--parchment)" }}
          >
            <Users className="w-8 h-8" />
            <span className="text-sm font-semibold">Manage Spirits</span>
          </Button>

          <Button
            onClick={() => {
              if (canEnterBattle) {
                onNavigate("battle");
              } else {
                alert(
                  "You must have at least one spirit in your active party to enter battle.",
                );
              }
            }}
            disabled={!canEnterBattle}
            className="p-6 flex flex-col items-center gap-2"
            style={{
              background: "var(--vermillion)",
              color: "var(--parchment)",
              opacity: canEnterBattle ? 1 : 0.5, // <-- Add visual feedback
            }}
          >
            <Swords className="w-8 h-8" />
            <span className="text-sm font-semibold">Enter Battle</span>
          </Button>
        </div>

        {/* Boss Button */}
        <Button
          onClick={() => {
            if (canEnterBattle) {
              onNavigate("boss");
            } else {
              alert(
                "You must have at least one spirit in your active party to challenge the boss.",
              );
            }
          }}
          disabled={!canEnterBattle}
          className="w-full p-6 flex flex-col items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #8B0000 0%, #FF4500 100%)",
            color: "var(--parchment)",
            opacity: canEnterBattle ? 1 : 0.5, // <-- Add visual feedback
          }}
        >
          <Swords className="w-10 h-10" />
          <span className="text-lg font-bold">⚔️ Challenge Boss ⚔️</span>
        </Button>

        {/* Reset Button */}
        <Button
          onClick={handleResetGame}
          variant="destructive"
          className="w-full p-4 mt-4"
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
      {/* Summon Screen Modal */}
      {/* This renders the SummonScreen when summonRequest is 1 or 10 */}
      {summonRequest !== null && (
        <SummonScreen
          onClose={() => setSummonRequest(null)}
          summonCount={summonRequest || 0}
        />
      )}
    </div>
  );
}
