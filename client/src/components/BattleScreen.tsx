import { useState, useEffect, useRef } from "react";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  getRarityColor,
  getElementColor,
  getPrimaryElement,
  getPotentialColor,
  calculateAllStats,
  getAvailableSkills as getSpiritAvailableSkills,
  getPassiveAbility,
} from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Swords,
  ArrowLeftRight,
  Heart,
  Shield,
  Loader2,
  ArrowUp,
  Info,
  X,
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
  onNavigate,
  returnTo = "cultivation",
  autoStart = false,
}: BattleScreenProps) {
  const logic = useBattleLogic({ onClose, isBossBattle: false, returnTo });
  const logContainerRef = useRef<HTMLDivElement>(null);
  const hasStartedBattle = useRef(false);

  const [isClient, setIsClient] = useState(false);
  const [inspectedSpiritIndex, setInspectedSpiritIndex] = useState<number | null>(null);
  const [showEnemyInfo, setShowEnemyInfo] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    battleState,
    turnPhase,
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
    showEmptyPartyDialog,
    setShowEmptyPartyDialog,
    showSpiritDefeatedDialog,
    setShowSpiritDefeatedDialog,
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
                  const isNeutral = elemId === "none";
                  return (
                    <span
                      key={elemId}
                      className="text-xs font-bold px-1.5 py-0.5 rounded [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        backgroundColor: getElementColor(elemId),
                        color: isNeutral ? "#000000" : "white",
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
              <div className="flex justify-between items-baseline mb-1 text-right gap-2">
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <span className="font-bold text-white text-2xl [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                    {activeEnemy.name}
                  </span>
                  <button
                    onClick={() => setShowEnemyInfo(true)}
                    className="p-1 rounded hover:bg-white/20 transition-colors"
                    title="View enemy info"
                  >
                    <Info className="w-5 h-5 text-white" />
                  </button>
                </div>
                <span className="text-lg text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.7)]">
                  Lv. {activeEnemy.level}
                </span>
              </div>
              <div className="flex gap-1 mb-1 flex-wrap justify-end">
                {activeEnemy.elements.map((elemId) => {
                  const elem = getElement(elemId);
                  const isNeutral = elemId === "none";
                  return (
                    <span
                      key={elemId}
                      className="text-xs font-bold px-1.5 py-0.5 rounded [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                      style={{
                        backgroundColor: getElementColor(elemId),
                        color: isNeutral ? "#000000" : "white",
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
        (activeSpirit.currentHealth > 0 || turnPhase === "player_forced_swap") && (
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
                      const isNeutral = skill.element === "none";
                      const element = getElement(skill.element);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            playButtonClick();
                            handleSkillSelect(skill.id);
                          }}
                          onMouseEnter={playButtonHover}
                          className={`p-3 rounded-lg text-left transition-all hover:brightness-125 ${isNeutral ? "text-black border-2 border-gray-400" : "text-white"}`}
                          style={{
                            backgroundColor: elementColor,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold">{skill.name}</p>
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded ml-2"
                              style={{
                                backgroundColor: isNeutral ? "#ffffff" : "rgba(0, 0, 0, 0.3)",
                                color: isNeutral ? "#000000" : "#ffffff",
                              }}
                            >
                              {element?.name || "Unknown"}
                            </span>
                          </div>
                          <p className="text-xs opacity-90">
                            {skill.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {actionMenu === "swap" && inspectedSpiritIndex === null && (
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
                            if (!isDead && !isActive) {
                              playButtonClick();
                              setInspectedSpiritIndex(index);
                            }
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
                                : "border-green-600 bg-black/50 hover:bg-green-900/50 cursor-pointer"
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

      {/* SPIRIT INSPECTION OVERLAY */}
      {inspectedSpiritIndex !== null && playerSpirits[inspectedSpiritIndex] && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
          <motion.div
            className="parchment-bg chinese-border max-w-2xl w-full p-6 rounded-lg max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {(() => {
              const spirit = playerSpirits[inspectedSpiritIndex];
              const baseSpirit = getBaseSpirit(spirit.playerSpirit.spiritId);
              if (!baseSpirit) return null;

              const stats = calculateAllStats(spirit.playerSpirit);
              const lineage = getLineage(baseSpirit.lineage);
              const primaryElement = getPrimaryElement(baseSpirit);
              const spiritSkills = getSpiritAvailableSkills(spirit.playerSpirit);
              const passiveAbility = baseSpirit.passiveAbilities.length > 0
                ? getPassiveAbility(baseSpirit.passiveAbilities[0])
                : null;

              return (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="parchment-text text-2xl font-bold">
                        {baseSpirit.name}
                      </h2>
                      <p className="parchment-text text-sm">
                        {lineage?.name} • Level {spirit.playerSpirit.level}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setInspectedSpiritIndex(null);
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white font-semibold"
                    >
                      Back
                    </button>
                  </div>

                  {/* Health Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm parchment-text mb-1">
                      <span>Health</span>
                      <span className="font-semibold">
                        {spirit.currentHealth} / {spirit.maxHealth}
                      </span>
                    </div>
                    <div className="w-full bg-gray-500 rounded-full h-4">
                      <div
                        className="h-4 rounded-full bg-green-600"
                        style={{
                          width: `${(spirit.currentHealth / spirit.maxHealth) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mb-4 parchment-bg p-3 rounded">
                    <h3 className="parchment-text font-bold mb-2">Stats</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="parchment-text">Attack:</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: getPotentialColor(
                              spirit.playerSpirit.potentialFactors.attack,
                            ),
                          }}
                        >
                          {stats.attack} [{spirit.playerSpirit.potentialFactors.attack}]
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="parchment-text">Defense:</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: getPotentialColor(
                              spirit.playerSpirit.potentialFactors.defense,
                            ),
                          }}
                        >
                          {stats.defense} [{spirit.playerSpirit.potentialFactors.defense}]
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="parchment-text">Health:</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: getPotentialColor(
                              spirit.playerSpirit.potentialFactors.health,
                            ),
                          }}
                        >
                          {stats.health} [{spirit.playerSpirit.potentialFactors.health}]
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="parchment-text">Agility:</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: getPotentialColor(
                              spirit.playerSpirit.potentialFactors.agility,
                            ),
                          }}
                        >
                          {stats.agility} [{spirit.playerSpirit.potentialFactors.agility}]
                        </span>
                      </div>
                      <div className="flex justify-between col-span-2">
                        <span className="parchment-text">Elemental Affinity:</span>
                        <span
                          className="font-semibold"
                          style={{
                            color: getPotentialColor(
                              spirit.playerSpirit.potentialFactors.affinity,
                            ),
                          }}
                        >
                          {stats.affinity} [
                          {spirit.playerSpirit.potentialFactors.affinity}]
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Effects */}
                  {spirit.activeEffects && spirit.activeEffects.length > 0 && (
                    <div className="mb-4 parchment-bg p-3 rounded">
                      <h3 className="parchment-text font-bold mb-2">Active Effects</h3>
                      <div className="space-y-1 text-sm">
                        {spirit.activeEffects.map((effect, idx) => (
                          <div key={idx} className="parchment-text">
                            • {effect.effectType}
                            {effect.turnsRemaining !== undefined &&
                              ` (${effect.turnsRemaining} turns)`}
                            {effect.stat && ` - ${effect.stat}`}
                            {effect.statMultiplier &&
                              ` ${Math.round((effect.statMultiplier - 1) * 100)}%`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Passive Ability */}
                  {passiveAbility && (
                    <div className="mb-4 parchment-bg p-3 rounded">
                      <h3 className="parchment-text font-bold mb-2">
                        Passive Ability
                      </h3>
                      <div className="parchment-text text-sm">
                        <p className="font-semibold">{passiveAbility.name}</p>
                        <p className="opacity-80">{passiveAbility.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  <div className="mb-4 parchment-bg p-3 rounded">
                    <h3 className="parchment-text font-bold mb-2">Skills</h3>
                    <div className="space-y-2">
                      {spiritSkills.map((skill) => {
                        const elementColor = getElementColor(skill.element);
                        const isNeutral = skill.element === "none";
                        const element = getElement(skill.element);
                        return (
                          <div
                            key={skill.id}
                            className="p-2 rounded"
                            style={{
                              backgroundColor: elementColor,
                              color: isNeutral ? "#000000" : "#ffffff",
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">
                                {skill.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-black/20">
                                {element?.name || "Unknown"}
                              </span>
                            </div>
                            <p className="text-xs opacity-90 mt-1">
                              {skill.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => {
                      playButtonClick();
                      setInspectedSpiritIndex(null);
                      setActionMenu("none");
                      handleSwap(inspectedSpiritIndex);
                    }}
                    disabled={
                      inspectedSpiritIndex === activePartySlot ||
                      spirit.currentHealth <= 0
                    }
                    className="w-full p-4 text-lg font-bold"
                    style={{
                      background:
                        inspectedSpiritIndex === activePartySlot ||
                        spirit.currentHealth <= 0
                          ? "var(--gray)"
                          : "var(--vermillion)",
                      color: "var(--parchment)",
                    }}
                  >
                    {inspectedSpiritIndex === activePartySlot
                      ? "Currently Active"
                      : spirit.currentHealth <= 0
                        ? "Spirit Defeated"
                        : "Swap to This Spirit"}
                  </Button>
                </>
              );
            })()}
          </motion.div>
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

      {/* EMPTY PARTY DIALOG */}
      <Dialog open={showEmptyPartyDialog} onOpenChange={setShowEmptyPartyDialog}>
        <DialogContent className="parchment-bg chinese-border">
          <DialogHeader>
            <DialogTitle className="parchment-text text-2xl font-bold text-center">
              Party is Empty
            </DialogTitle>
            <DialogDescription className="parchment-text text-center mt-2">
              You need to add spirits to your active party before entering battle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setShowEmptyPartyDialog(false);
                if (onNavigate) {
                  onNavigate("spirits");
                } else {
                  onClose();
                }
              }}
              className="w-full font-bold"
              style={{
                background: "var(--jade-green)",
                color: "var(--parchment)",
              }}
            >
              Go to Spirit Manager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SPIRIT DEFEATED DIALOG */}
      <Dialog open={showSpiritDefeatedDialog}>
        <DialogContent 
          className="parchment-bg chinese-border"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="parchment-text text-2xl font-bold text-center text-red-700">
              Spirit Defeated!
            </DialogTitle>
            <DialogDescription className="parchment-text text-center mt-2">
              {activeBaseSpirit?.name} has been defeated! Choose a replacement spirit to continue the battle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                playButtonClick();
                setShowSpiritDefeatedDialog(false);
                setActionMenu("swap");
              }}
              className="w-full font-bold"
              style={{
                background: "var(--vermillion)",
                color: "var(--parchment)",
              }}
            >
              Choose Replacement Spirit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ENEMY INFO MODAL */}
      <Dialog open={showEnemyInfo} onOpenChange={setShowEnemyInfo}>
        <DialogContent className="max-w-4xl max-h-[85vh] parchment-bg" style={{ background: "#F5E6D3" }}>
          {activeEnemy && (() => {
            const baseSpirit = getBaseSpirit(activeEnemy.spiritId);
            if (!baseSpirit) return null;

            const lineage = getLineage(baseSpirit.lineage);
            // Get all skills for this spirit and filter by enemy's current level
            const availableSkillIds = baseSpirit.skills
              .filter((bs) => bs.unlockLevel <= activeEnemy.level)
              .map((bs) => bs.skillId);
            
            // Get the full skill objects from the available skill IDs
            const allSkills = getSpiritAvailableSkills({ level: activeEnemy.level } as any);
            const filteredSkills = allSkills.filter((skill) =>
              availableSkillIds.includes(skill.id)
            );

            return (
              <div className="flex flex-col gap-4" style={{ maxHeight: "80vh" }}>
                {/* Close Button */}
                <button
                  onClick={() => setShowEnemyInfo(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-200 transition-colors"
                  style={{ color: "#8B4513" }}
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
                
                {/* Header with Spirit Name */}
                <div className="pb-3 border-b-2" style={{ borderColor: "#8B4513" }}>
                  <h3 className="text-2xl font-bold parchment-text mb-2">
                    {baseSpirit.name}
                  </h3>
                  <div className="flex gap-2 flex-wrap items-center text-sm">
                    <span
                      className="text-xs font-bold px-2 py-1 rounded border-2"
                      style={{
                        background: getRarityColor(baseSpirit.rarity),
                        color: "white",
                        borderColor: "#8B4513",
                      }}
                    >
                      {baseSpirit.rarity.charAt(0).toUpperCase() + baseSpirit.rarity.slice(1)}
                    </span>
                    <span className="text-xs parchment-text bg-white px-2 py-1 rounded border-2" style={{ borderColor: "#8B4513" }}>
                      Level {activeEnemy.level}
                    </span>
                    {baseSpirit.elements.map((elemId) => {
                      const elem = getElement(elemId);
                      const isNeutral = elemId === "none";
                      return (
                        <span
                          key={elemId}
                          className="text-xs font-bold px-2 py-1 rounded"
                          style={{
                            backgroundColor: getElementColor(elemId),
                            color: isNeutral ? "#000000" : "white",
                          }}
                        >
                          {elem?.name}
                        </span>
                      );
                    })}
                    <span className="text-xs parchment-text font-semibold px-2 py-1 rounded bg-white border-2" style={{ borderColor: "#8B4513" }}>
                      {lineage.name}
                    </span>
                  </div>
                </div>

                {/* Three Column Layout */}
                <div className="grid grid-cols-3 gap-4 flex-1 overflow-hidden">
                  {/* LEFT COLUMN: Spirit Sprite */}
                  <div className="flex flex-col items-center justify-center gap-4 py-2">
                    <div className="flex items-center justify-center flex-1 min-h-0">
                      <SpiritSpriteAnimation
                        spiritId={baseSpirit.id}
                        position="left"
                        size={200}
                        isTakingDamage={false}
                        isDefeated={false}
                      />
                    </div>
                  </div>

                  {/* MIDDLE COLUMN: Combat Stats */}
                  <div className="space-y-4 flex flex-col">
                    <div className="p-3 rounded-lg border-2 flex-1" style={{ background: "#FFFFFF", borderColor: "#8B4513" }}>
                      <h4 className="font-bold parchment-text text-sm mb-3">
                        Combat Stats
                      </h4>
                      <div className="space-y-2 text-sm parchment-text">
                        <div className="flex justify-between">
                          <span>Attack:</span>
                          <span className="font-semibold">{activeEnemy.attack}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Defense:</span>
                          <span className="font-semibold">{activeEnemy.defense}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health:</span>
                          <span className="font-semibold">{activeEnemy.maxHealth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agility:</span>
                          <span className="font-semibold">{activeEnemy.agility}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Affinity:</span>
                          <span className="font-semibold">{activeEnemy.affinity}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Passive Abilities + Skills */}
                  <div className="space-y-4 flex flex-col overflow-y-auto" style={{ maxHeight: "55vh" }}>
                    <div className="p-3 rounded-lg border-2 flex-shrink-0" style={{ background: "#FFFFFF", borderColor: "#8B4513" }}>
                      <h4 className="font-bold parchment-text text-sm mb-2">
                        Passive Abilities
                      </h4>
                      <div className="text-sm parchment-text space-y-1">
                        {baseSpirit.passiveAbilities &&
                        baseSpirit.passiveAbilities.length > 0 ? (
                          baseSpirit.passiveAbilities.map((passiveId) => {
                            const passive = getPassiveAbility(passiveId);
                            return (
                              <div key={passiveId}>
                                <p className="font-semibold">
                                  {passive ? passive.name : "Unknown Passive"}
                                </p>
                                <p className="text-xs opacity-75">
                                  {passive ? passive.description : ""}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="opacity-75">
                            None
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border-2 flex-shrink-0" style={{ background: "#FFFFFF", borderColor: "#8B4513" }}>
                      <h4 className="font-bold parchment-text text-sm mb-2">
                        Skills
                      </h4>
                      <div className="space-y-2">
                        {filteredSkills.map((skill) => {
                          const skillElement = getElement(skill.element);
                          const isNeutral = skill.element === "none";
                          return (
                            <div
                              key={skill.id}
                              className="p-2 bg-amber-50 rounded border border-amber-300"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="font-semibold parchment-text text-xs">
                                  {skill.name}
                                </p>
                                {skillElement && (
                                  <span
                                    className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                                    style={{
                                      backgroundColor: getElementColor(skill.element),
                                      color: isNeutral ? "#000000" : "white",
                                    }}
                                  >
                                    {skillElement.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs parchment-text opacity-75">
                                {skill.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
