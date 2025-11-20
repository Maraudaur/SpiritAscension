import { useEffect, useState } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import { Sparkles, Volume2, VolumeX, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import spiritsData from "@shared/data/spirits.json";
import encountersData from "@shared/data/encounters.json";
import type { BaseSpirit, Encounter } from "@shared/types";

type Screen = "story" | "cultivation" | "spirits" | "summon" | "battle";

const SCREEN_TITLES: Record<Screen, string> = {
  story: "Journey",
  cultivation: "Ascension",
  spirits: "Spirit Manager",
  summon: "Summoning",
  battle: "Battle",
};

interface QiHUDProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

export function QiHUD({ currentScreen, onNavigate }: QiHUDProps) {
  const { qi, qiPerSecond, resetGame, freeSummons, toggleFreeSummons, freeLevelUp, toggleFreeLevelUp, spawnSpecificSpirit, setCurrentEncounterId, setDebugEncounter } = useGameState();
  const { isMuted, toggleMute, volume, setVolume } = useAudio();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);
  const [selectedSpiritId, setSelectedSpiritId] = useState<string>("");
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>("");
  const [spawnMessage, setSpawnMessage] = useState<string>("");
  const [debugSpiritLevel, setDebugSpiritLevel] = useState<number>(5);

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return Math.floor(num).toLocaleString();
  };

  const handleSpawnSpirit = () => {
    if (!selectedSpiritId) {
      setSpawnMessage("Please select a spirit first");
      setTimeout(() => setSpawnMessage(""), 2000);
      return;
    }

    const result = spawnSpecificSpirit(selectedSpiritId, debugSpiritLevel);
    if (result) {
      const spiritData = getAllSpirits().find((s) => s.id === selectedSpiritId);
      setSpawnMessage(`✅ Spawned ${spiritData?.name} Lv${debugSpiritLevel}!`);
      setTimeout(() => setSpawnMessage(""), 2000);
    } else {
      setSpawnMessage("❌ Failed to spawn spirit");
      setTimeout(() => setSpawnMessage(""), 2000);
    }
  };

  const handleStartEncounter = () => {
    if (!selectedEncounterId) {
      setSpawnMessage("Please select an encounter first");
      setTimeout(() => setSpawnMessage(""), 2000);
      return;
    }

    const encounter = (encountersData as Encounter[]).find((e) => e.id === selectedEncounterId);
    if (encounter) {
      setCurrentEncounterId(selectedEncounterId);
      onNavigate("battle");
      setShowDebugMenu(false);
      setSpawnMessage(`⚔️ Starting ${encounter.name}!`);
      setTimeout(() => setSpawnMessage(""), 2000);
    } else {
      setSpawnMessage("❌ Encounter not found");
      setTimeout(() => setSpawnMessage(""), 2000);
    }
  };

  const handleFightSpirit = () => {
    if (!selectedSpiritId) {
      setSpawnMessage("Please select a spirit first");
      setTimeout(() => setSpawnMessage(""), 2000);
      return;
    }

    const spiritData = getAllSpirits().find((s) => s.id === selectedSpiritId);
    if (spiritData) {
      // Create a debug encounter with the selected spirit
      const debugEncounter: Encounter = {
        id: "debug_fight",
        name: `Debug: ${spiritData.name}`,
        averageLevel: debugSpiritLevel,
        enemies: [
          {
            spiritId: selectedSpiritId,
            level: debugSpiritLevel,
            ai: ["r000"] // Random AI
          }
        ],
        rewards: {
          qi: 0
        },
        penalties: {
          qiLoss: 0
        }
      };
      
      // Set this as a debug encounter and navigate to battle
      setDebugEncounter(debugEncounter);
      onNavigate("battle");
      setShowDebugMenu(false);
      setSpawnMessage(`⚔️ Fighting ${spiritData.name} Lv${debugSpiritLevel}!`);
      setTimeout(() => setSpawnMessage(""), 2000);
    } else {
      setSpawnMessage("❌ Spirit not found");
      setTimeout(() => setSpawnMessage(""), 2000);
    }
  };

  const getAllSpirits = (): BaseSpirit[] => {
    const allSpirits: BaseSpirit[] = [];
    const spiritsDataTyped = spiritsData as Record<string, BaseSpirit[]>;
    for (const rarity of Object.keys(spiritsDataTyped)) {
      allSpirits.push(...spiritsDataTyped[rarity]);
    }
    return allSpirits;
  };

  return (
    <div
      className="flex items-center justify-between gap-8 px-6 py-3 relative"
      style={{
        background: "linear-gradient(135deg, #D4B896 0%, #C1A877 50%, #D4B896 100%)",
        borderBottom: "3px solid #8B4513",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
      }}
    >
      {/* LEFT: Volume Control */}
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          title="Volume Control"
          className="bg-white/90 backdrop-blur-sm"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </Button>

        <AnimatePresence>
          {showVolumeSlider && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 left-0 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border-2 border-amber-700 z-50"
              style={{ width: "200px" }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold parchment-text">
                    Volume
                  </span>
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

      {/* CENTER: Qi Energy Display */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-full"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              boxShadow: "0 2px 6px rgba(255, 215, 0, 0.4)",
            }}
          >
            <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          
          <div className="flex flex-col">
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: "#5D4037" }}
            >
              QI ENERGY
            </span>
            <span
              className="text-2xl font-bold tracking-tight"
              style={{
                color: "#C1272D",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              }}
            >
              {formatNumber(qi)}
            </span>
          </div>
        </div>

        <div
          className="h-10 w-px"
          style={{ background: "linear-gradient(to bottom, transparent, #8B4513, transparent)" }}
        />

        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span
              className="text-xs font-semibold tracking-wide"
              style={{ color: "#5D4037" }}
            >
              GENERATION
            </span>
            <div className="flex items-baseline gap-1">
              <span
                className="text-lg font-bold"
                style={{
                  color: "#2E7D32",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                }}
              >
                +{formatNumber(qiPerSecond)}
              </span>
              <span className="text-xs font-medium" style={{ color: "#5D4037" }}>
                /sec
              </span>
            </div>
          </div>
        </div>

        {/* FREE SUMMONS INDICATOR */}
        {freeSummons && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="px-3 py-1 rounded-full font-bold text-xs tracking-wider"
            style={{
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "white",
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.5), 0 0 20px rgba(245, 158, 11, 0.3)",
              border: "2px solid #FBBF24",
            }}
          >
            🎁 FREE SUMMONS
          </motion.div>
        )}

        {/* FREE LEVEL UP INDICATOR */}
        {freeLevelUp && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="px-3 py-1 rounded-full font-bold text-xs tracking-wider"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              color: "white",
              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)",
              border: "2px solid #34D399",
            }}
          >
            ⚡ FREE LEVEL UP
          </motion.div>
        )}
      </div>

      {/* RIGHT: Screen Title */}
      <div className="flex items-center gap-4">
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{
            color: "#5D4037",
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
          }}
        >
          {SCREEN_TITLES[currentScreen]}
        </h2>

        {/* ========== DEBUG BUTTON - REMOVE IN PRODUCTION ========== */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDebugMenu(!showDebugMenu)}
            title="Debug Menu"
            className="bg-orange-100/90 backdrop-blur-sm border-orange-400 hover:bg-orange-200"
          >
            <Bug size={20} className="text-orange-600" />
          </Button>

          <AnimatePresence>
            {showDebugMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-14 right-0 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-lg border-2 border-orange-600 z-50"
                style={{ width: "220px" }}
              >
                <div className="space-y-2">
                  <div className="text-sm font-bold text-orange-700 mb-3 border-b border-orange-300 pb-2">
                    Debug Controls
                  </div>
                  
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Are you sure you want to reset all game progress? This cannot be undone."
                        )
                      ) {
                        console.log("--- RESETTING GAME ---");
                        resetGame();
                        console.log("In-memory state reset. Reloading page...");
                        window.location.reload();
                      }
                    }}
                    className="w-full text-xs"
                  >
                    Reset Game
                  </Button>

                  <div 
                    className={`flex items-center justify-between pt-2 border-t border-orange-300 mt-2 px-2 py-2 rounded transition-colors ${
                      freeSummons ? 'bg-amber-100 border-amber-400' : ''
                    }`}
                  >
                    <label htmlFor="free-summons" className={`text-xs font-medium cursor-pointer ${
                      freeSummons ? 'text-amber-700 font-bold' : 'text-orange-700'
                    }`}>
                      Free Summons
                    </label>
                    <Switch
                      id="free-summons"
                      checked={freeSummons}
                      onCheckedChange={toggleFreeSummons}
                    />
                  </div>

                  <div 
                    className={`flex items-center justify-between px-2 py-2 rounded transition-colors ${
                      freeLevelUp ? 'bg-green-100 border-green-400' : ''
                    }`}
                  >
                    <label htmlFor="free-levelup" className={`text-xs font-medium cursor-pointer ${
                      freeLevelUp ? 'text-green-700 font-bold' : 'text-orange-700'
                    }`}>
                      Free Level Up
                    </label>
                    <Switch
                      id="free-levelup"
                      checked={freeLevelUp}
                      onCheckedChange={toggleFreeLevelUp}
                    />
                  </div>

                  <div className="pt-2 border-t border-orange-300 mt-2 space-y-2">
                    <div className="text-xs font-medium text-orange-700 mb-1">
                      Choose Spirit
                    </div>
                    <select
                      value={selectedSpiritId}
                      onChange={(e) => setSelectedSpiritId(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-orange-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">-- Select Spirit --</option>
                      {Object.entries(spiritsData as Record<string, BaseSpirit[]>).map(([rarity, spirits]) => (
                        <optgroup key={rarity} label={rarity.toUpperCase()}>
                          {spirits.map((spirit) => (
                            <option key={spirit.id} value={spirit.id}>
                              {spirit.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-orange-700 whitespace-nowrap">Level:</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={debugSpiritLevel}
                        onChange={(e) => setDebugSpiritLevel(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="flex-1 text-xs px-2 py-1.5 border border-orange-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSpawnSpirit}
                        disabled={!selectedSpiritId}
                        className="text-xs bg-orange-600 hover:bg-orange-700"
                      >
                        Spawn
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleFightSpirit}
                        disabled={!selectedSpiritId}
                        className="text-xs bg-red-600 hover:bg-red-700"
                      >
                        Fight
                      </Button>
                    </div>
                    {spawnMessage && (
                      <div className="text-xs text-center font-medium text-orange-700 py-1">
                        {spawnMessage}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-orange-300 mt-2 space-y-2">
                    <div className="text-xs font-medium text-orange-700 mb-1">
                      Fight Encounter
                    </div>
                    <select
                      value={selectedEncounterId}
                      onChange={(e) => setSelectedEncounterId(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 border border-orange-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">-- Select Encounter --</option>
                      {(encountersData as Encounter[]).map((encounter) => (
                        <option key={encounter.id} value={encounter.id}>
                          {encounter.id} - {encounter.name} (Lv{encounter.averageLevel})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartEncounter}
                      disabled={!selectedEncounterId}
                      className="w-full text-xs bg-red-600 hover:bg-red-700"
                    >
                      Start Battle
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* ========== END DEBUG BUTTON ========== */}
      </div>
    </div>
  );
}
