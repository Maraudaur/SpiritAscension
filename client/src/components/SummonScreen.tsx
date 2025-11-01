import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  getRarityColor,
  getPotentialColor,
  calculateAllStats,
  getPassiveAbility,
} from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerSpirit, Rarity } from "@shared/types";

interface SummonScreenProps {
  onClose: () => void;
  summonCount?: number; // NEW: Number of summons to perform
}

type SummonStage = "idle" | "channeling" | "revealing" | "revealed";

const RARITY_GLOW_COLORS: Record<Rarity, string> = {
  common: "#9CA3AF",
  uncommon: "#10B981",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
};

export function SummonScreen({ onClose, summonCount = 0 }: SummonScreenProps) {
  const {
    summonSpirit, // Used for single summons
    spendQi,
    getSpiritCost,
    qi,
    addEssence,
    getMultiSummonCost, // NEW
    summonMultipleSpirits, // NEW
  } = useGameState();
  const { isMuted, toggleMute } = useAudio();
  const [summonedSpirit, setSummonedSpirit] = useState<PlayerSpirit | null>(
    null,
  );
  const [stage, setStage] = useState<SummonStage>(
    summonCount > 0 ? "channeling" : "idle",
  );
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );

  // NEW: State for multi-summon queue
  const [summonQueue, setSummonQueue] = useState<PlayerSpirit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const spiritCost = getSpiritCost();

  // This function starts the reveal animation for a given spirit
  const startReveal = (spirit: PlayerSpirit) => {
    setSummonedSpirit(spirit);
    setStage("channeling");

    // Channeling phase (1.5 seconds)
    setTimeout(() => {
      setStage("revealing");

      const baseSpirit = getBaseSpirit(spirit.spiritId);
      if (baseSpirit) {
        const audio = new Audio("/sounds/success.mp3");
        audio.volume = 0.5;
        audio.play();
        setAudioElement(audio);
      }

      // Reveal phase (2 seconds)
      setTimeout(() => {
        setStage("revealed");
      }, 2000);
    }, 1500);
  };

  // This handles a single summon (called from 'idle' screen or useEffect)
  const handleSingleSummon = () => {
    const cost = getSpiritCost();
    if (spendQi(cost)) {
      const spirit = summonSpirit(); // This adds spirit to state

      // Grant essence
      const baseSpirit = getBaseSpirit(spirit.spiritId);
      if (baseSpirit) {
        const reward = 5 + spirit.level * 2; // 7
        addEssence(baseSpirit.id, reward);
      }

      startReveal(spirit);
    } else {
      // Not enough Qi, just close
      onClose();
    }
  };

  // This handles a multi-summon (called from useEffect)
  const handleMultiSummon = (count: number) => {
    const cost = getMultiSummonCost(count);
    if (spendQi(cost)) {
      const newSpirits = summonMultipleSpirits(count); // Adds spirits to state

      // Grant essence for all new spirits
      newSpirits.forEach((spirit) => {
        const baseSpirit = getBaseSpirit(spirit.spiritId);
        if (baseSpirit) {
          const reward = 5 + spirit.level * 2; // 7
          addEssence(baseSpirit.id, reward);
        }
      });

      setSummonQueue(newSpirits);
      setCurrentIndex(0);
      startReveal(newSpirits[0]); // Start reveal for the first spirit
    } else {
      onClose();
    }
  };

  // NEW: useEffect to trigger summon on load
  useEffect(() => {
    if (summonCount === 1) {
      handleSingleSummon();
    } else if (summonCount > 1) {
      handleMultiSummon(summonCount);
    }
    // If summonCount is 0, it stays on 'idle' stage (set in useState)
  }, [summonCount]);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  // This is what the 'Continue' button does
  const handleContinue = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    // Check if we are in a multi-summon queue
    if (summonQueue.length > 0) {
      const nextIndex = currentIndex + 1;
      if (nextIndex < summonQueue.length) {
        // More spirits to show
        setCurrentIndex(nextIndex);
        startReveal(summonQueue[nextIndex]);
      } else {
        // End of queue
        setSummonQueue([]); // Clear queue
        onClose();
      }
    } else {
      // Was a single summon
      onClose();
    }
  };

  const baseSpirit = summonedSpirit
    ? getBaseSpirit(summonedSpirit.spiritId)
    : null;
  const element = baseSpirit ? getElement(baseSpirit.element) : null;
  const lineage = baseSpirit ? getLineage(baseSpirit.lineage) : null;
  const stats = summonedSpirit ? calculateAllStats(summonedSpirit) : null;
  const passive =
    baseSpirit && baseSpirit.passiveAbility
      ? getPassiveAbility(baseSpirit.passiveAbility)
      : null;
  const rarityColor = baseSpirit
    ? RARITY_GLOW_COLORS[baseSpirit.rarity]
    : "#FFF";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-2xl w-full p-8 rounded-lg relative">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 parchment-text hover:opacity-70"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-6 parchment-text brush-stroke">
          {/* NEW: Show summon count if multi-summoning */}
          {summonQueue.length > 0
            ? `Summoning (${currentIndex + 1}/${summonQueue.length})`
            : "Spirit Summoning Circle"}
        </h2>

        <AnimatePresence mode="wait">
          {stage === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              {/* ... (This is the original idle screen content) ... */}
              <div className="mb-6">
                <div className="w-48 h-48 mx-auto rounded-full border-4 border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                  <Sparkles
                    className="w-24 h-24"
                    style={{ color: "var(--imperial-gold)" }}
                  />
                </div>
              </div>
              <div className="mb-6 parchment-text space-y-2">
                <p className="text-lg font-semibold">
                  Summon a new spirit to aid your cultivation
                </p>
                <p className="text-sm opacity-75">
                  Cost: {spiritCost} Qi (Current: {Math.floor(qi)})
                </p>
              </div>
              {/* ... (Summoning Rates box) ... */}
              <div className="mb-6 p-4 bg-amber-50 rounded border-2 border-amber-300">
                <h3 className="font-bold parchment-text mb-2">
                  Summoning Rates
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  {/* ... (rates) ... */}
                </div>
              </div>

              <Button
                onClick={handleSingleSummon} // Changed from handleSummon
                className="w-full p-6 text-lg font-bold"
                style={{
                  background: "var(--jade-green)",
                  color: "var(--parchment)",
                }}
                disabled={qi < spiritCost}
              >
                Summon Spirit
              </Button>
            </motion.div>
          )}

          {/*Channeling Phase*/}
          {stage === "channeling" && (
            <motion.div
              key="channeling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center h-96 flex flex-col items-center justify-center parchment-text"
            >
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-48 h-48 rounded-full border-8 border-t-imperial-gold border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center"
              >
                <Sparkles
                  className="w-24 h-24"
                  style={{ color: "var(--imperial-gold)" }}
                />
              </motion.div>
              <p className="text-lg font-semibold mt-6">
                Channeling spiritual energy...
              </p>
            </motion.div>
          )}

          {/*Revealing Phase*/}
          {stage === "revealing" && baseSpirit && (
            <motion.div
              key="revealing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="text-center h-96 flex flex-col items-center justify-center"
            >
              <motion.div
                key={summonedSpirit?.instanceId} // Force remount for animation
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.2,
                }}
                style={{
                  boxShadow: `0 0 40px 15px ${rarityColor}, 0 0 10px 5px ${rarityColor} inset`,
                }}
                className="w-48 h-48 rounded-full flex items-center justify-center"
              >
                <img
                  src={`/images/spirits/${baseSpirit.id}.png`}
                  alt={baseSpirit.name}
                  className="w-36 h-36"
                />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-3xl font-bold parchment-text mt-6"
                style={{ color: rarityColor }}
              >
                {baseSpirit.name}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-xl parchment-text"
                style={{ color: getRarityColor(baseSpirit.rarity) }}
              >
                {baseSpirit.rarity.charAt(0).toUpperCase() +
                  baseSpirit.rarity.slice(1)}
              </motion.p>
            </motion.div>
          )}
          {stage === "revealed" &&
            summonedSpirit &&
            baseSpirit &&
            element &&
            lineage &&
            stats && (
              <motion.div
                key="revealed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} // <-- The exit prop is key!
                className="space-y-4"
              >
                {/* --- START: Spirit Details Box Content --- */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Left Column: Image */}
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className="w-32 h-32 rounded-full flex items-center justify-center"
                      style={{
                        boxShadow: `0 0 20px 8px ${rarityColor}, 0 0 5px 2px ${rarityColor} inset`,
                      }}
                    >
                      <img
                        src={`/images/spirits/${baseSpirit.id}.png`}
                        alt={baseSpirit.name}
                        className="w-24 h-24"
                      />
                    </div>
                    {summonedSpirit.isPrismatic && (
                      <span className="prismatic-text font-bold text-sm mt-2">
                        PRISMATIC
                      </span>
                    )}
                  </div>

                  {/* Middle Column: Info */}
                  <div className="col-span-2 space-y-2">
                    <h3
                      className="text-3xl font-bold parchment-text"
                      style={{ color: rarityColor }}
                    >
                      {baseSpirit.name}
                    </h3>

                    {/* ADDED: Level */}
                    <p className="text-lg font-semibold parchment-text -mt-1">
                      Level {summonedSpirit.level}
                    </p>

                    <div className="flex gap-4 text-sm parchment-text">
                      <span
                        className="font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: getRarityColor(baseSpirit.rarity),
                          color:
                            baseSpirit.rarity === "common" ? "#111" : "#FFF",
                        }}
                      >
                        {baseSpirit.rarity.toUpperCase()}
                      </span>
                      <span
                        className="font-semibold px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: element.color,
                          color: "#FFF",
                        }}
                      >
                        {element.name.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm parchment-text opacity-80 italic">
                      {lineage.description}
                    </p>

                    {/* ADDED: Passive Info */}
                    <div className="pt-1">
                      <p className="text-sm parchment-text font-bold">
                        Passive: {passive ? passive.name : "None"}
                      </p>
                      <p className="text-xs parchment-text opacity-80">
                        {passive ? passive.description : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* MODIFIED: Stats Section */}
                <div className="mt-4 pt-4 border-t-2 border-amber-700/50">
                  {/* Changed "Base Stats" to "Stats" and centered */}
                  <h4 className="font-semibold mb-2 text-center text-lg parchment-text">
                    Stats
                  </h4>
                  <div className="parchment-text space-y-1 max-w-xs mx-auto">
                    {/* HP with Potential */}
                    <div className="flex justify-between text-base">
                      <span>HP:</span>
                      <span className="font-medium">
                        {stats.health}{" "}
                        <span
                          className="font-bold"
                          style={{
                            color: getPotentialColor(
                              summonedSpirit.potentialFactors.health,
                            ),
                          }}
                        >
                          ({summonedSpirit.potentialFactors.health})
                        </span>
                      </span>
                    </div>

                    {/* ATK with Potential */}
                    <div className="flex justify-between text-base">
                      <span>ATK:</span>
                      <span className="font-medium">
                        {stats.attack}{" "}
                        <span
                          className="font-bold"
                          style={{
                            color: getPotentialColor(
                              summonedSpirit.potentialFactors.attack,
                            ),
                          }}
                        >
                          ({summonedSpirit.potentialFactors.attack})
                        </span>
                      </span>
                    </div>

                    {/* DEF with Potential */}
                    <div className="flex justify-between text-base">
                      <span>DEF:</span>
                      <span className="font-medium">
                        {stats.defense}{" "}
                        <span
                          className="font-bold"
                          style={{
                            color: getPotentialColor(
                              summonedSpirit.potentialFactors.defense,
                            ),
                          }}
                        >
                          ({summonedSpirit.potentialFactors.defense})
                        </span>
                      </span>
                    </div>

                    {/* ADDED: AFFINITY with Potential */}
                    <div className="flex justify-between text-base">
                      <span>AFFINITY:</span>
                      <span className="font-medium">
                        {stats.elementalAffinity}{" "}
                        <span
                          className="font-bold"
                          style={{
                            color: getPotentialColor(
                              summonedSpirit.potentialFactors.elementalAffinity,
                            ),
                          }}
                        >
                          ({summonedSpirit.potentialFactors.elementalAffinity})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ADDED: Harmonize Reward Text */}
                <div className="mt-4 pt-4 border-t-2 border-amber-700/50 text-center parchment-text text-sm italic">
                  You received{" "}
                  <span className="font-bold">
                    {/* This calculation is from your handleSummon functions */}
                    {5 + summonedSpirit.level * 2} {baseSpirit.name} Essence
                  </span>{" "}
                  for this summon.
                </div>
                {/* --- END: Spirit Details Box Content --- */}
                <Button
                  onClick={handleContinue} // This button now correctly handles queues
                  className="w-full p-4 text-lg font-bold"
                  style={{
                    background: "var(--vermillion)",
                    color: "var(--parchment)",
                  }}
                >
                  {/* NEW: Change button text if in queue */}
                  {summonQueue.length > 0 &&
                  currentIndex < summonQueue.length - 1
                    ? `Next (${currentIndex + 2}/${summonQueue.length})`
                    : "Continue"}
                </Button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
