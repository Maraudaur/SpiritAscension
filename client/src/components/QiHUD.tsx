import { useEffect, useState } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import { Sparkles, Volume2, VolumeX, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";

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
}

export function QiHUD({ currentScreen }: QiHUDProps) {
  const { qi, qiPerSecond, resetGame, freeSummons, toggleFreeSummons } = useGameState();
  const { isMuted, toggleMute, volume, setVolume } = useAudio();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);

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

                  <div className="flex items-center justify-between pt-2 border-t border-orange-300 mt-2">
                    <label htmlFor="free-summons" className="text-xs font-medium text-orange-700 cursor-pointer">
                      Free Summons
                    </label>
                    <Switch
                      id="free-summons"
                      checked={freeSummons}
                      onCheckedChange={toggleFreeSummons}
                    />
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
