import { getBaseSpirit, getElement, getLineage, getRarityColor } from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import {
  X,
  Swords,
  ArrowLeftRight,
  Heart,
  Shield,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion } from "framer-motion";
import type { BattleScreenProps } from "@/lib/battle-types";
import { useBattleLogic } from "@/lib/hooks/useBattleLogic";

export function BattleScreen({
  onClose,
  isBossBattle = false,
}: BattleScreenProps) {
  // Use the battle logic hook instead of managing state internally
  const logic = useBattleLogic({ onClose, isBossBattle });
  
  // Destructure all needed values from the hook
  const {
    battleState,
    activePartySlot,
    battleLog,
    playerSpirits,
    battleEnemies,
    activeEnemyIndex,
    activeEnemy,
    battleRewards,
    actionMenu,
    isBlocking,
    playerHealthBarShake,
    enemyHealthBarShake,
    playerHealthBarHeal,
    bossState,
    currentEncounter,
    activeSpirit,
    activeBaseSpirit,
    activeStats,
    availableSkills,
    canStartBattle,
    setActionMenu,
    playButtonClick,
    playButtonHover,
    isMuted,
    toggleMute,
    startBattle,
    handleSwap,
    handleBlock,
    handleSkillSelect,
    handleContinueBattle,
    handleClose,
  } = logic;

  // Check if no spirits in party - this is handled by the hook
  if (playerSpirits.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
        <div className="parchment-bg chinese-border max-w-md w-full p-8 rounded-lg relative">
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
          <h2 className="text-2xl font-bold text-center mb-4 parchment-text">
            Cannot Start Battle
          </h2>
          <p className="parchment-text text-center">
            You need to add spirits to your active party before entering battle!
          </p>
          <Button
            onClick={onClose}
            className="w-full mt-4"
            style={{
              background: "var(--vermillion)",
              color: "var(--parchment)",
            }}
          >
            Return
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-6xl w-full h-[90vh] p-6 rounded-lg relative flex flex-col">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm z-10"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 parchment-text hover:opacity-70 z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-4 parchment-text brush-stroke">
          {isBossBattle ? "⚔️ Boss Battle ⚔️" : "Cultivation Battle"}
        </h2>

        {/* Battle Scene Placeholder */}
        <div className="w-full h-64 bg-gradient-to-b from-amber-100 to-amber-200 rounded-lg border-4 border-amber-700 mb-4 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-20 h-20 bg-amber-800 rounded-full blur-xl"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-amber-800 rounded-full blur-xl"></div>
          </div>
          <p className="text-2xl font-bold parchment-text opacity-30 italic z-10">
            Battle Scene
          </p>
        </div>

        {/* Spirit Info Panels */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Player Spirit Info */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-blue-600">
            <h3 className="font-bold parchment-text mb-2 text-blue-800">
              Your Spirit
            </h3>
            {activeSpirit && activeBaseSpirit && activeStats ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold parchment-text text-lg">
                      {activeBaseSpirit.name}
                    </span>
                    <div className="text-xs parchment-text opacity-80">
                      <span className="capitalize">
                        Element: {activeBaseSpirit.element}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm parchment-text">
                    Lv. {activeSpirit.playerSpirit.level}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm parchment-text mb-1">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> HP
                    </span>
                    <span>
                      {activeSpirit.currentHealth} / {activeSpirit.maxHealth}
                    </span>
                  </div>
                  <motion.div
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: playerHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="bg-green-600 h-4 rounded-full transition-all"
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
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {activeStats.attack}</div>
                  <div>DEF: {activeStats.defense}</div>
                </div>
                {isBlocking && (
                  <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-400">
                    <p className="text-xs font-bold text-blue-800 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Blocking!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm parchment-text opacity-50">
                No active spirit
              </p>
            )}
          </div>

          {/* Enemy Spirit Info */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-red-600">
            <h3 className="font-bold parchment-text mb-2 text-red-800">
              Enemy
            </h3>
            {activeEnemy ? (
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold parchment-text text-lg">
                      {activeEnemy.name}
                    </span>
                    {/* --- ADDED THIS LINE --- */}
                    <div className="text-xs parchment-text opacity-80">
                      <span className="capitalize">
                        Element: {activeEnemy.element}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm parchment-text">
                    Lv. {activeEnemy.level}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-sm parchment-text mb-1">
                    <span>HP</span>
                    <span>
                      {activeEnemy.currentHealth} / {activeEnemy.maxHealth}
                    </span>
                  </div>
                  <motion.div
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: enemyHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <div
                      className="bg-red-600 h-4 rounded-full transition-all"
                      style={{
                        width: `${(activeEnemy.currentHealth / activeEnemy.maxHealth) * 100}%`,
                      }}
                    />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {activeEnemy.attack}</div>
                  <div>DEF: {activeEnemy.defense}</div>
                </div>
                {isBossBattle && (
                  <div className="mt-2 space-y-1">
                    {bossState.atkBuffTurnsRemaining > 0 && (
                      <div className="p-2 bg-red-100 rounded border border-red-400">
                        <p className="text-xs font-bold text-red-800">
                          ⚡ ATK Buffed! ({bossState.atkBuffTurnsRemaining}{" "}
                          turns)
                        </p>
                      </div>
                    )}
                    {bossState.isCharging && (
                      <div className="p-2 bg-yellow-100 rounded border border-yellow-400">
                        <p className="text-xs font-bold text-yellow-800 animate-pulse">
                          ⚡ Charging...
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm parchment-text opacity-50">No enemy</p>
            )}
          </div>
        </div>

        {/* Battle Log */}
        <div className="flex-1 p-3 bg-amber-50 rounded border-2 border-amber-700 scroll-container mb-4 max-h-32">
          <div className="space-y-1 text-xs parchment-text">
            {battleLog.map((log, index) => (
              <p key={index} className="opacity-75">
                &gt; {log}
              </p>
            ))}
          </div>
        </div>

        {/* Action Buttons and Submenus */}

        {/* --- SETUP BLOCK --- */}
        {battleState === "setup" && (
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
        )}

        {/* --- FIGHTING BLOCK --- */}
        {battleState === "fighting" &&
          activeSpirit &&
          activeSpirit.currentHealth > 0 && (
            <div>
              {actionMenu === "none" && (
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleSkillSelect("basic_attack");
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Swords className="w-6 h-6" />
                    <span>Attack</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      handleBlock();
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Shield className="w-6 h-6" />
                    <span>Block</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("skills");
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <Swords className="w-6 h-6" />
                    <span>Skills</span>
                  </button>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu("swap");
                    }}
                    onMouseEnter={playButtonHover}
                    className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                  >
                    <ArrowLeftRight className="w-6 h-6" />
                    <span>Swap</span>
                  </button>
                </div>
              )}

              {actionMenu === "skills" && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold parchment-text text-lg">
                      Select Skill
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-semibold"
                    >
                      Back
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {availableSkills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => {
                          playButtonClick();
                          handleSkillSelect(skill.id);
                        }}
                        onMouseEnter={playButtonHover}
                        className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-left"
                      >
                        <p className="font-bold">{skill.name}</p>
                        <p className="text-xs opacity-90">
                          {skill.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {actionMenu === "swap" && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold parchment-text text-lg">
                      Swap Spirit
                    </h3>
                    <button
                      onClick={() => {
                        playButtonClick();
                        setActionMenu("none");
                      }}
                      onMouseEnter={playButtonHover}
                      className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-semibold"
                    >
                      Back
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {playerSpirits.map((spirit, index) => {
                      const baseSpirit = getBaseSpirit(
                        spirit.playerSpirit.spiritId,
                      );
                      const element = baseSpirit
                        ? getElement(baseSpirit.element)
                        : null;
                      const lineage = baseSpirit
                        ? getLineage(baseSpirit.lineage)
                        : null;
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
                          className={`p-3 rounded-lg border-2 text-left flex gap-3 ${
                            isActive
                              ? "border-blue-600 bg-blue-100 cursor-not-allowed"
                              : isDead
                                ? "border-gray-400 bg-gray-200 opacity-50 cursor-not-allowed"
                                : "border-green-600 bg-white hover:bg-green-50"
                          }`}
                        >
                          <img
                            src="/icons/placeholdericon.png"
                            alt={baseSpirit?.name}
                            className="w-24 h-24 object-contain flex-shrink-0"
                          />
                          <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold parchment-text truncate flex-1">
                                {baseSpirit?.name}
                              </p>
                              <span className="text-xs parchment-text ml-2">
                                Lv. {spirit.playerSpirit.level}
                              </span>
                            </div>
                            {element && lineage && (
                              <div className="flex justify-between items-center mb-2">
                                <span
                                  className={`text-xs element-${element.id}`}
                                >
                                  {element.name} | {lineage.name}
                                </span>
                                {baseSpirit && (
                                  <span
                                    className="text-xs font-bold px-1.5 py-0.5 rounded ml-1 flex-shrink-0"
                                    style={{
                                      background: getRarityColor(
                                        baseSpirit.rarity,
                                      ),
                                      color: "white",
                                    }}
                                  >
                                    {baseSpirit.rarity[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="w-full bg-gray-300 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${isDead ? "bg-gray-500" : "bg-green-600"}`}
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
                </div>
              )}
            </div>
          )}

        {/* --- VICTORY BLOCK --- */}
        {battleState === "victory" && battleRewards && (
          <div className="p-4 bg-green-100 rounded-lg border-2 border-green-600">
            <h3 className="font-bold text-green-800 text-2xl mb-3 text-center">
              🎉 {isBossBattle ? "Boss Defeated!" : "Victory!"} 🎉
            </h3>
            <p className="text-md text-green-800 mb-3 text-center font-semibold">
              {isBossBattle
                ? "You have defeated the mighty boss! Your cultivation deepens..."
                : "You defeated the enemy! A new challenger approaches..."}
            </p>
            <div className="mb-4 space-y-2 p-3 bg-white rounded border border-green-400">
              <p className="text-lg font-bold text-green-800">
                Battle Rewards:
              </p>
              <p className="text-md text-green-800">✦ +{battleRewards.qi} Qi</p>
              <p className="text-md text-green-800">
                ✦ +{battleRewards.qiGeneration.toFixed(1)} to Qi generation per
                second
              </p>
              <p className="text-sm text-green-700 mt-2 italic">
                All spirits have been fully healed!
              </p>
            </div>
            {isBossBattle ? (
              <Button
                onClick={handleClose}
                className="w-full font-bold"
                style={{
                  background: "var(--jade-green)",
                  color: "var(--parchment)",
                }}
              >
                Return to Cultivation
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleContinueBattle}
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
                  Return to Cultivation
                </Button>
              </div>
            )}
          </div>
        )}

        {/* --- DEFEAT BLOCK --- */}
        {battleState === "defeat" && (
          <div className="p-4 bg-red-100 rounded-lg border-2 border-red-600">
            <h3 className="font-bold text-red-800 text-2xl mb-3 text-center">
              Defeat...
            </h3>
            <p className="text-md text-red-800 mb-2 text-center">
              All your spirits have been defeated.
            </p>
            <p className="text-sm text-red-700 mb-4 text-center italic">
              Return to cultivation and strengthen your spirits before trying
              again.
            </p>
            <Button
              onClick={handleClose}
              className="w-full font-bold"
              style={{
                background: "var(--vermillion)",
                color: "var(--parchment)",
              }}
            >
              Return to Cultivation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
