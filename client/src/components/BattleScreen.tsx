import { useState, useEffect, useRef } from "react";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  getRarityColor,
  getElementColor,
  getPrimaryElement,
} from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import {
  Swords,
  ArrowLeftRight,
  Heart,
  Shield,
  Loader2,
  ArrowUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { BattleScreenProps } from "@/lib/battle-types";
import { useBattleLogic } from "@/lib/hooks/useBattleLogic";
import { SpiritSpriteAnimation } from "./SpiritSpriteAnimation";

// --- NEW MODAL OVERLAY COMPONENT ---
// This will wrap Setup, Victory, and Defeat screens
function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose} // Optional: click backdrop to close
    >
      <motion.div
        className="parchment-bg chinese-border max-w-md w-full p-8 rounded-lg"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
        onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to backdrop
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// A simple loading component
function BattleLoadingScreen() {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-black/80">
      <div className="parchment-bg chinese-border max-w-md w-full p-8 rounded-lg">
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <Loader2 className="w-12 h-12 parchment-text animate-spin" />
          <p className="parchment-text text-lg font-semibold mt-4">
            Loading Battle...
          </p>
        </div>
      </div>
    </div>
  );
}

export function BattleScreen({
  onClose,
  returnTo = "cultivation",
  autoStart = false,
}: BattleScreenProps) {
  const logic = useBattleLogic({ onClose, isBossBattle: false, returnTo });
  const logContainerRef = useRef<HTMLDivElement>(null);
  const hasStartedBattle = useRef(false);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    battleState,
    activePartySlot,
    activeParty,
    battleLog,
    playerSpirits,
    activeEnemy,
    battleRewards,
    actionMenu,
    isBlocking,
    isPaused,
    playerHealthBarShake,
    enemyHealthBarShake,
    playerHealthBarHeal,
    activeSpirit,
    activeBaseSpirit,
    activeStats,
    availableSkills,
    setActionMenu,
    playButtonClick,
    playButtonHover,
    isMuted,
    toggleMute,
    startBattle,
    handleSwap,
    handleBlock,
    handleSkillSelect,
    handleClose,
    confirmEnemyDefeat,
  } = logic;

  // Auto-start guard: prevents double initialization in React StrictMode/double-render scenarios
  useEffect(() => {
    if (autoStart && battleState === "setup" && !hasStartedBattle.current) {
      hasStartedBattle.current = true;
      startBattle();
    }
  }, [autoStart, battleState, startBattle]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [battleLog]);

  const [playerLagHealth, setPlayerLagHealth] = useState(
    activeSpirit?.currentHealth || 0,
  );
  const [enemyLagHealth, setEnemyLagHealth] = useState(
    activeEnemy?.currentHealth || 0,
  );

  const prevPlayerHealth = useRef(activeSpirit?.currentHealth || 0);
  const prevEnemyHealth = useRef(activeEnemy?.currentHealth || 0);

  useEffect(() => {
    const newHealth = activeSpirit?.currentHealth || 0;
    if (newHealth < prevPlayerHealth.current) {
      setTimeout(() => {
        setPlayerLagHealth(newHealth);
      }, 500);
    } else {
      setPlayerLagHealth(newHealth);
    }
    prevPlayerHealth.current = newHealth;
  }, [activeSpirit?.currentHealth]);

  useEffect(() => {
    const newHealth = activeEnemy?.currentHealth || 0;
    if (newHealth < prevEnemyHealth.current) {
      setTimeout(() => {
        setEnemyLagHealth(newHealth);
      }, 500);
    } else {
      setEnemyLagHealth(newHealth);
    }
    prevEnemyHealth.current = newHealth;
  }, [activeEnemy?.currentHealth]);

  if (!isClient) {
    return <BattleLoadingScreen />;
  }

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{
        // --- 1. BACKGROUND IMAGE ---
        // !!! IMPORTANT: Change this path to your actual battle background !!!
        backgroundImage: "url('/images/backgrounds/battle-bg-placeholder.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* --- 2. SPIRITE SPOTS --- */}

      {/* Player Spirit Sprite (Left) */}
      <div
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: "5vw",
          bottom: "10vh",
          width: "30vh", // 30% of viewport height
          height: "30vh",
        }}
      >
        {activeSpirit && activeBaseSpirit && (
          <SpiritSpriteAnimation
            spiritId={activeBaseSpirit.id}
            position="left"
            size={300} // Use a fixed size or calculate based on vh
            isTakingDamage={playerHealthBarShake}
            isDefeated={activeSpirit.currentHealth <= 0}
          />
        )}
      </div>

      {/* Enemy Spirit Sprite (Right) */}
      <div
        className="absolute z-10 flex items-center justify-center"
        style={{
          right: "5vw",
          top: "15vh",
          width: "60vh", // Larger for the boss
          height: "60vh",
        }}
      >
        {activeEnemy && (
          <SpiritSpriteAnimation
            spiritId={activeEnemy.spiritId}
            position="right"
            size={300} // Larger
            isTakingDamage={enemyHealthBarShake}
            isDefeated={battleState === "enemy_defeated"}
            onDefeatAnimationComplete={confirmEnemyDefeat}
          />
        )}
      </div>

      {/* --- 3. UI OVERLAYS --- */}

      {/* Player Spirit Info (Bottom-Left) */}
      <div className="absolute z-20 bottom-24 left-8 w-72">
        <AnimatePresence mode="wait">
          {activeSpirit && activeBaseSpirit && activeStats ? (
            <motion.div
              key={activeSpirit.playerSpirit.instanceId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-white text-2xl [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                  {activeBaseSpirit.name}
                </span>
                <span className="text-lg text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                  Lv. {activeSpirit.playerSpirit.level}
                </span>
              </div>
              <div className="flex gap-1 mb-1 flex-wrap">
                {activeBaseSpirit.elements.map((elemId) => {
                  const elem = getElement(elemId);
                  return (
                    <span
                      key={elemId}
                      className="text-xs font-bold px-1.5 py-0.5 rounded [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        backgroundColor: getElementColor(elemId),
                        color: "white",
                      }}
                    >
                      {elem?.name}
                    </span>
                  );
                })}
              </div>
              {/* HP Bar */}
              <motion.div
                className="w-full bg-gray-900/70 rounded-full h-5 overflow-hidden relative border-2 border-white/50"
                animate={{
                  x: playerHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                }}
                transition={{ duration: 0.5 }}
              >
                {/* Lag Bar */}
                <motion.div
                  className="bg-yellow-400 h-full rounded-full absolute top-0 left-0"
                  style={{
                    width: `${(playerLagHealth / activeSpirit.maxHealth) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {/* Health Bar */}
                <motion.div
                  className="bg-green-600 h-full rounded-full transition-all relative"
                  style={{
                    width: `${(activeSpirit.currentHealth / activeSpirit.maxHealth) * 100}%`,
                  }}
                  animate={{
                    boxShadow: playerHealthBarHeal
                      ? [
                          "0 0 0px rgba(34, 197, 94, 0)",
                          "0 0 15px rgba(34, 197, 94, 0.8)",
                          "0 0 0px rgba(34, 197, 94, 0)",
                        ]
                      : "0 0 0px rgba(34, 197, 94, 0)",
                  }}
                  transition={{ duration: 0.6 }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-bold text-white text-xs [text-shadow:0_1px_2px_rgba(0,0,0,1)]">
                    {activeSpirit.currentHealth} / {activeSpirit.maxHealth}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <div key="no-player-spirit" /> // Empty div to maintain layout
          )}
        </AnimatePresence>
      </div>

      {/* Enemy Spirit Info (Top-Right) */}
      <div className="absolute z-20 top-8 right-8 w-72">
        <AnimatePresence mode="wait">
          {activeEnemy ? (
            <motion.div
              key={activeEnemy.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-baseline mb-1 text-right">
                <span className="font-bold text-white text-2xl [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                  {activeEnemy.name}
                </span>
                <span className="text-lg text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                  Lv. {activeEnemy.level}
                </span>
              </div>
              <div className="flex gap-1 mb-1 flex-wrap justify-end">
                {activeEnemy.elements.map((elemId) => {
                  const elem = getElement(elemId);
                  return (
                    <span
                      key={elemId}
                      className="text-xs font-bold px-1.5 py-0.5 rounded [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        backgroundColor: getElementColor(elemId),
                        color: "white",
                      }}
                    >
                      {elem?.name}
                    </span>
                  );
                })}
              </div>
              {/* HP Bar */}
              <motion.div
                className="w-full bg-gray-900/70 rounded-full h-5 overflow-hidden relative border-2 border-white/50"
                animate={{
                  x: enemyHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                }}
                transition={{ duration: 0.5 }}
              >
                {/* Lag Bar */}
                <motion.div
                  className="bg-yellow-400 h-full rounded-full absolute top-0 left-0"
                  style={{
                    width: `${(enemyLagHealth / activeEnemy.maxHealth) * 100}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {/* Health Bar */}
                <div
                  className="bg-red-600 h-full rounded-full transition-all relative"
                  style={{
                    width: `${(activeEnemy.currentHealth / activeEnemy.maxHealth) * 100}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-bold text-white text-xs [text-shadow:0_1px_2px_rgba(0,0,0,1)]">
                    {activeEnemy.currentHealth} / {activeEnemy.maxHealth}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <div key="no-enemy" /> // Empty div
          )}
        </AnimatePresence>
      </div>

      {/* Battle Log (Bottom-Right) */}
      <div
        ref={logContainerRef}
        className="absolute z-20 bottom-8 right-8 w-1/3 max-w-md h-48 overflow-y-auto scroll-container p-3 bg-black/50 rounded-lg border border-white/30 text-sm text-white/90 space-y-1"
      >
        {battleLog.map((log, index) => (
          <p key={index} className="text-white/70">
            &gt; {log}
          </p>
        ))}
      </div>

      {/* Action Buttons and Submenus (Bottom-Left, next to Player UI) */}
      {battleState === "fighting" &&
        activeSpirit &&
        activeSpirit.currentHealth > 0 && (
          <div
            className="absolute z-30 bottom-10"
            style={{ left: "320px" }} // Positioned to the right of Player UI
          >
            <AnimatePresence mode="wait">
              {actionMenu === "none" && (
                <motion.div
                  key="main-menu"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-start gap-1"
                >
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleSkillSelect("basic_attack");
                    }}
                    onMouseEnter={playButtonHover}
                    className="text-white text-3xl font-bold [text-shadow:2px_2px_4px_#000] hover:text-yellow-300 transition-colors"
                    disabled={isPaused}
                  >
                    FIGHT!
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("skills");
                    }}
                    onMouseEnter={playButtonHover}
                    className="text-white text-3xl font-bold [text-shadow:2px_2px_4px_#000] hover:text-yellow-300 transition-colors"
                    disabled={isPaused}
                  >
                    SKILLS
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("swap");
                    }}
                    onMouseEnter={playButtonHover}
                    className="text-white text-3xl font-bold [text-shadow:2px_2px_4px_#000] hover:text-yellow-300 transition-colors"
                    disabled={isPaused}
                  >
                    SPIRIT
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleClose();
                    }}
                    onMouseEnter={playButtonHover}
                    className="text-white text-3xl font-bold [text-shadow:2px_2px_4px_#000] hover:text-yellow-300 transition-colors"
                    disabled={isPaused}
                  >
                    ESCAPE
                  </button>
                </motion.div>
              )}

              {actionMenu === "skills" && (
                <motion.div
                  key="skills-menu"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 bg-black/70 rounded-lg border border-white/30 w-72"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-white text-lg">
                      Select Skill
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold text-white"
                    >
                      Back
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {availableSkills.map((skill) => {
                      const elementColor = getElementColor(skill.element);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            playButtonClick();
                            handleSkillSelect(skill.id);
                          }}
                          onMouseEnter={playButtonHover}
                          className="p-3 text-white rounded-lg text-left transition-all hover:brightness-125"
                          style={{
                            backgroundColor: elementColor,
                          }}
                        >
                          <p className="font-bold">{skill.name}</p>
                          <p className="text-xs opacity-90">
                            {skill.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {actionMenu === "swap" && (
                <motion.div
                  key="swap-menu"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4 bg-black/70 rounded-lg border border-white/30 w-[500px]" // Wider for swap
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-white text-lg">
                      Swap Spirit
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm font-semibold text-white"
                    >
                      Back
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                    {playerSpirits.map((spirit, index) => {
                      const baseSpirit = getBaseSpirit(
                        spirit.playerSpirit.spiritId,
                      );
                      const isActive = index === activePartySlot;
                      const isDead = spirit.currentHealth <= 0;

                      return (
                        <button
                          key={spirit.playerSpirit.instanceId}
                          onClick={() => {
                            if (!isDead && !isActive) playButtonClick();
                            handleSwap(index);
                          }}
                          onMouseEnter={() => {
                            if (!isDead && !isActive) playButtonHover();
                          }}
                          disabled={isDead || isActive}
                          className={`p-2 rounded-lg border-2 text-left flex gap-2 ${
                            isActive
                              ? "border-blue-400 bg-blue-900/50 cursor-not-allowed"
                              : isDead
                                ? "border-gray-600 bg-gray-800/50 opacity-50 cursor-not-allowed"
                                : "border-green-600 bg-black/50 hover:bg-green-900/50"
                          }`}
                        >
                          {/* Note: Using placeholder, update as needed */}
                          <img
                            src="/icons/placeholdericon.png"
                            alt={baseSpirit?.name}
                            className="w-16 h-16 object-contain flex-shrink-0 bg-white/10 rounded"
                          />
                          <div className="flex-1 flex flex-col min-w-0 text-white">
                            <p className="text-sm font-bold truncate">
                              {baseSpirit?.name}
                            </p>
                            <span className="text-xs">
                              Lv. {spirit.playerSpirit.level}
                            </span>
                            <div className="w-full bg-gray-500 rounded-full h-3 mt-1">
                              <div
                                className={`h-3 rounded-full ${isDead ? "bg-gray-700" : "bg-green-600"}`}
                                style={{
                                  width: `${(spirit.currentHealth / spirit.maxHealth) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      {/* --- 4. MODALS (Setup, Victory, Defeat) --- */}
      <AnimatePresence>
        {/* SETUP MODAL */}
        {battleState === "setup" && (
          <ModalOverlay>
            <h2 className="text-2xl font-bold text-center mb-4 parchment-text">
              Prepare for Battle!
            </h2>
            <Button
              onClick={startBattle}
              className="w-full p-4 text-lg font-bold"
              style={{
                background: "var(--vermillion)",
                color: "var(--parchment)",
              }}
            >
              Begin Battle
            </Button>
          </ModalOverlay>
        )}

        {/* NO SPIRITS MODAL */}
        {activeParty.length === 0 && !isClient && (
          <ModalOverlay onClose={onClose}>
            <h2 className="text-2xl font-bold text-center mb-4 parchment-text">
              Cannot Start Battle
            </h2>
            <p className="parchment-text text-center">
              You need to add spirits to your active party before entering
              battle!
            </p>
            <Button
              onClick={onClose}
              className="w-full mt-4"
              style={{
                background: "var(--vermillion)",
                color: "var(--parchment)",
              }}
            >
              Return to {returnTo === "story" ? "Story" : "Cultivation"}
            </Button>
          </ModalOverlay>
        )}

        {/* VICTORY MODAL */}
        {battleState === "victory" && battleRewards && (
          <ModalOverlay>
            <div className="p-4">
              <h3 className="font-bold text-green-800 text-2xl mb-3 text-center">
                🎉 Victory! 🎉
              </h3>
              <p className="text-md text-green-800 mb-3 text-center font-semibold">
                You defeated the enemy! A new challenger approaches...
              </p>
              <div className="mb-4 space-y-2 p-3 bg-white rounded border border-green-400">
                <p className="text-lg font-bold text-green-800">
                  Battle Rewards:
                </p>
                <p className="text-md text-green-800">
                  ✦ +{battleRewards.qi} Qi
                </p>
                <p className="text-md text-green-800">
                  ✦ +{battleRewards.qiGeneration.toFixed(1)} to Qi generation
                  per second
                </p>
                <p className="text-sm text-green-700 mt-2 italic">
                  All spirits have been fully healed!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={startBattle}
                  className="w-full font-bold"
                  style={{
                    background: "var(--vermillion)",
                    color: "var(--parchment)",
                  }}
                >
                  Continue Battling
                </Button>
                <Button
                  onClick={handleClose}
                  className="w-full font-bold"
                  style={{
                    background: "var(--jade-green)",
                    color: "var(--parchment)",
                  }}
                >
                  Return to {returnTo === "story" ? "Story" : "Cultivation"}
                </Button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* DEFEAT MODAL */}
        {battleState === "defeat" && (
          <ModalOverlay>
            <div className="p-4">
              <h3 className="font-bold text-red-800 text-2xl mb-3 text-center">
                Defeat...
              </h3>
              <p className="text-md text-red-800 mb-2 text-center">
                All your spirits have been defeated.
              </p>
              <p className="text-sm text-red-700 mb-4 text-center italic">
                {returnTo === "story"
                  ? "Return to your journey and prepare for the trial ahead."
                  : "Return to cultivation and strengthen your spirits before trying again."}
              </p>
              <Button
                onClick={handleClose}
                className="w-full font-bold"
                style={{
                  background: "var(--vermillion)",
                  color: "var(--parchment)",
                }}
              >
                Return to {returnTo === "story" ? "Story" : "Cultivation"}
              </Button>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}
