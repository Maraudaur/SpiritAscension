import { useState, useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
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
import { Sparkles, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PlayerSpirit, Rarity } from "@shared/types";

type SummonStage = "idle" | "channeling" | "revealing" | "revealed";

const RARITY_GLOW_COLORS: Record<Rarity, string> = {
  common: "#9CA3AF",
  uncommon: "#10B981",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
  boss: "#E11D48",
};

interface SummonScreenProps {
  onNavigate: (screen: "story" | "cultivation" | "spirits" | "summon" | "battle") => void;
}

export function SummonScreen({ onNavigate }: SummonScreenProps) {
  const {
    summonSpirit,
    spendQi,
    getSpiritCost,
    qi,
    addEssence,
    getMultiSummonCost,
    summonMultipleSpirits,
  } = useGameState();
  
  const [summonedSpirit, setSummonedSpirit] = useState<PlayerSpirit | null>(
    null,
  );
  const [stage, setStage] = useState<SummonStage>("idle");
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  const [summonQueue, setSummonQueue] = useState<PlayerSpirit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSummonRates, setShowSummonRates] = useState(false);

  const spiritCost = getSpiritCost();
  const multiSummonCost = getMultiSummonCost(10);
  const canSummonOne = qi >= spiritCost;
  const canSummonTen = qi >= multiSummonCost;

  const startReveal = (spirit: PlayerSpirit) => {
    setSummonedSpirit(spirit);
    setStage("channeling");

    setTimeout(() => {
      setStage("revealing");

      const baseSpirit = getBaseSpirit(spirit.spiritId);
      if (baseSpirit) {
        const audio = new Audio("/sounds/success.mp3");
        audio.volume = 0.5;
        audio.play();
        setAudioElement(audio);
      }

      setTimeout(() => {
        setStage("revealed");
      }, 2000);
    }, 1500);
  };

  const handleSingleSummon = () => {
    const cost = getSpiritCost();
    if (spendQi(cost)) {
      const spirit = summonSpirit();

      const baseSpirit = getBaseSpirit(spirit.spiritId);
      if (baseSpirit) {
        const reward = 5 + spirit.level * 2;
        addEssence(baseSpirit.id, reward);
      }

      startReveal(spirit);
    }
  };

  const handleMultiSummon = (count: number) => {
    const cost = getMultiSummonCost(count);
    if (spendQi(cost)) {
      const newSpirits = summonMultipleSpirits(count);

      newSpirits.forEach((spirit) => {
        const baseSpirit = getBaseSpirit(spirit.spiritId);
        if (baseSpirit) {
          const reward = 5 + spirit.level * 2;
          addEssence(baseSpirit.id, reward);
        }
      });

      setSummonQueue(newSpirits);
      setCurrentIndex(0);
      startReveal(newSpirits[0]);
    }
  };

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  const handleContinue = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    if (summonQueue.length > 0) {
      const nextIndex = currentIndex + 1;
      if (nextIndex < summonQueue.length) {
        setCurrentIndex(nextIndex);
        startReveal(summonQueue[nextIndex]);
      } else {
        setSummonQueue([]);
        setStage("idle");
      }
    } else {
      setStage("idle");
    }
  };

  const baseSpirit = summonedSpirit
    ? getBaseSpirit(summonedSpirit.spiritId)
    : null;
  const element = baseSpirit ? getElement(baseSpirit.element) : null;
  const lineage = baseSpirit ? getLineage(baseSpirit.lineage) : null;
  const stats = summonedSpirit ? calculateAllStats(summonedSpirit) : null;
  const passiveId = baseSpirit?.passiveAbilities?.[0];
  const passive = passiveId ? getPassiveAbility(passiveId) : null;
  const rarityColor = baseSpirit
    ? RARITY_GLOW_COLORS[baseSpirit.rarity]
    : "#FFF";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full h-full flex flex-col p-6 overflow-y-auto" style={{ background: "#F5E6D3" }}>
        <AnimatePresence mode="wait">
          {stage === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              {/* Main Summon Area */}
              <div className="max-w-2xl w-full parchment-bg chinese-border p-8 rounded-lg mb-6">
                <h2 className="text-3xl font-bold text-center mb-6 parchment-text brush-stroke">
                  Spirit Summoning Circle
                </h2>

                <div className="mb-6">
                  <div className="w-48 h-48 mx-auto rounded-full border-4 border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                    <Sparkles
                      className="w-24 h-24"
                      style={{ color: "var(--imperial-gold)" }}
                    />
                  </div>
                </div>

                <div className="mb-6 parchment-text text-center space-y-2">
                  <p className="text-lg font-semibold">
                    Summon powerful spirits to aid your cultivation
                  </p>
                  <p className="text-sm opacity-75">
                    Current Qi: {Math.floor(qi)}
                  </p>
                </div>

                {/* Summoning Rates Info */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold parchment-text">Summoning Rates</h3>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setShowSummonRates(!showSummonRates)}
                      className="bg-white/80 h-8 w-8"
                    >
                      <Info size={16} />
                    </Button>
                  </div>
                  
                  {showSummonRates && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 bg-amber-50 rounded border-2 border-amber-300 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm parchment-text">
                        <div className="flex justify-between">
                          <span style={{ color: getRarityColor("common") }}>Common:</span>
                          <span>60%</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: getRarityColor("uncommon") }}>Uncommon:</span>
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
                          <span style={{ color: getRarityColor("legendary") }}>Legendary:</span>
                          <span>1%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="prismatic-border px-1 rounded">Prismatic:</span>
                          <span>0.1%</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Summon Buttons */}
                <div className="grid grid-cols-2 gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSingleSummon}
                        disabled={!canSummonOne}
                        className="w-full p-6 text-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        style={{
                          background: canSummonOne ? "var(--jade-green)" : "#999",
                          color: "var(--parchment)",
                          boxShadow: canSummonOne ? "0 4px 6px rgba(76, 132, 119, 0.4)" : "none",
                        }}
                      >
                        Summon Spirit
                        <div className="text-sm font-normal mt-1">({spiritCost} Qi)</div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="parchment-bg border-2 border-amber-700">
                      <p className="parchment-text text-xs">
                        Summon a single spirit
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => handleMultiSummon(10)}
                        disabled={!canSummonTen}
                        className="w-full p-6 text-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        style={{
                          background: canSummonTen ? "var(--jade-green)" : "#999",
                          color: "var(--parchment)",
                          boxShadow: canSummonTen ? "0 4px 6px rgba(76, 132, 119, 0.4)" : "none",
                        }}
                      >
                        Summon 10 Spirits
                        <div className="text-sm font-normal mt-1">({multiSummonCost} Qi)</div>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="parchment-bg border-2 border-amber-700">
                      <p className="parchment-text text-xs">
                        Guarantees at least 1 Rare or higher spirit
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          )}

          {/* Channeling Phase */}
          {stage === "channeling" && (
            <motion.div
              key="channeling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center parchment-text"
            >
              <div className="max-w-2xl w-full parchment-bg chinese-border p-8 rounded-lg">
                <h2 className="text-3xl font-bold text-center mb-8 parchment-text brush-stroke">
                  {summonQueue.length > 0
                    ? `Summoning (${currentIndex + 1}/${summonQueue.length})`
                    : "Spirit Summoning Circle"}
                </h2>
                
                <div className="h-96 flex flex-col items-center justify-center">
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
                </div>
              </div>
            </motion.div>
          )}

          {/* Revealing Phase */}
          {stage === "revealing" && baseSpirit && (
            <motion.div
              key="revealing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="max-w-2xl w-full parchment-bg chinese-border p-8 rounded-lg">
                <h2 className="text-3xl font-bold text-center mb-8 parchment-text brush-stroke">
                  {summonQueue.length > 0
                    ? `Summoning (${currentIndex + 1}/${summonQueue.length})`
                    : "Spirit Summoning Circle"}
                </h2>
                
                <div className="h-96 flex flex-col items-center justify-center">
                  <motion.div
                    key={summonedSpirit?.instanceId}
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
                </div>
              </div>
            </motion.div>
          )}

          {/* Revealed Phase */}
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
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center overflow-y-auto"
              >
                <div className="max-w-2xl w-full parchment-bg chinese-border p-8 rounded-lg">
                  <h2 className="text-3xl font-bold text-center mb-6 parchment-text brush-stroke">
                    {summonQueue.length > 0
                      ? `Summoning (${currentIndex + 1}/${summonQueue.length})`
                      : "Spirit Summoned"}
                  </h2>

                  <div className="grid grid-cols-3 gap-4 mb-4">
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

                    <div className="col-span-2 space-y-2">
                      <h3
                        className="text-3xl font-bold parchment-text"
                        style={{ color: rarityColor }}
                      >
                        {baseSpirit.name}
                      </h3>

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

                  <div className="mt-4 pt-4 border-t-2 border-amber-700/50">
                    <h4 className="font-semibold mb-2 text-center text-lg parchment-text">
                      Stats
                    </h4>
                    <div className="parchment-text space-y-1 max-w-xs mx-auto">
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

                  <div className="mt-4 pt-4 border-t-2 border-amber-700/50 text-center parchment-text text-sm italic">
                    You received{" "}
                    <span className="font-bold">
                      {5 + summonedSpirit.level * 2} {baseSpirit.name} Essence
                    </span>{" "}
                    for this summon.
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <Button
                      onClick={handleContinue}
                      className="w-full p-4 text-lg font-bold"
                      style={{
                        background: "var(--vermillion)",
                        color: "var(--parchment)",
                      }}
                    >
                      {summonQueue.length > 0 &&
                      currentIndex < summonQueue.length - 1
                        ? `Next (${currentIndex + 2}/${summonQueue.length})`
                        : "Summon Again"}
                    </Button>
                    <Button
                      onClick={() => onNavigate("cultivation")}
                      className="w-full p-4 text-lg font-bold"
                      style={{
                        background: "var(--azure)",
                        color: "var(--parchment)",
                      }}
                    >
                      Return to Cultivation
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
