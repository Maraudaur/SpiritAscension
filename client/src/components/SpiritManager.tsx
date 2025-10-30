import { useState, useEffect } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { useAudio } from '@/lib/stores/useAudio';
import { getBaseSpirit, getElement, getLineage, getRarityColor, getPotentialColor, calculateAllStats, getAvailableSkills } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2, ArrowUp, Sparkles, TrendingUp, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerSpirit } from '@shared/types';

interface SpiritManagerProps {
  onClose: () => void;
}

interface StatComparison {
  attack: { old: number; new: number };
  defense: { old: number; new: number };
  health: { old: number; new: number };
  elementalAffinity: { old: number; new: number };
}

export function SpiritManager({ onClose }: SpiritManagerProps) {
  const { spirits, activeParty, qi, addToParty, removeFromParty, levelUpSpirit, harmonizeSpirit, getEssenceCount, getLevelUpCost } = useGameState();
  const { isMuted, toggleMute } = useAudio();
  const [selectedSpirit, setSelectedSpirit] = useState<PlayerSpirit | null>(null);
  const [showHarmonizeConfirm, setShowHarmonizeConfirm] = useState(false);
  const [levelUpAnimation, setLevelUpAnimation] = useState<{
    spirit: PlayerSpirit;
    oldLevel: number;
    newLevel: number;
    stats: StatComparison;
  } | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  const handleAddToParty = (instanceId: string) => {
    addToParty(instanceId);
  };

  const handleRemoveFromParty = (instanceId: string) => {
    removeFromParty(instanceId);
  };

  const handleLevelUp = (instanceId: string) => {
    const spirit = spirits.find(s => s.instanceId === instanceId);
    if (!spirit) return;

    // Calculate old stats
    const oldStats = calculateAllStats(spirit);
    const oldLevel = spirit.level;

    // Level up the spirit
    levelUpSpirit(instanceId);

    // Get updated spirit and calculate new stats
    // We need to manually create the leveled up spirit for the animation
    const newSpirit = { ...spirit, level: spirit.level + 1 };
    const newStats = calculateAllStats(newSpirit);

    // Create stat comparison
    const statComparison: StatComparison = {
      attack: { old: oldStats.attack, new: newStats.attack },
      defense: { old: oldStats.defense, new: newStats.defense },
      health: { old: oldStats.health, new: newStats.health },
      elementalAffinity: { old: oldStats.elementalAffinity, new: newStats.elementalAffinity },
    };

    // Show animation
    setLevelUpAnimation({
      spirit: newSpirit,
      oldLevel,
      newLevel: newSpirit.level,
      stats: statComparison,
    });

    // Play sound effect
    const audio = new Audio('/sounds/success.mp3');
    audio.volume = 0.6;
    audio.play();
    setAudioElement(audio);
  };

  const closeLevelUpAnimation = () => {
    // Update selected spirit to reflect the new stats
    if (levelUpAnimation) {
      const updatedSpirit = spirits.find(s => s.instanceId === levelUpAnimation.spirit.instanceId);
      if (updatedSpirit) {
        setSelectedSpirit(updatedSpirit);
      }
    }
    setLevelUpAnimation(null);
  };

  const handleHarmonize = (instanceId: string) => {
    harmonizeSpirit(instanceId);
    setShowHarmonizeConfirm(false);
    setSelectedSpirit(null);
  };

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
          onClick={onClose}
          className="absolute top-4 right-4 parchment-text hover:opacity-70 z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-4 parchment-text brush-stroke">
          Spirit Collection
        </h2>

        <div className="mb-4 p-4 bg-amber-50 rounded border-2 border-amber-700">
          <h3 className="font-bold parchment-text mb-2">Active Battle Party ({activeParty.length}/4)</h3>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((index) => {
              const spiritInstanceId = activeParty[index];
              const spirit = spirits.find(s => s.instanceId === spiritInstanceId);
              const baseSpirit = spirit ? getBaseSpirit(spirit.spiritId) : null;

              return (
                <div
                  key={index}
                  className={`p-3 rounded border-2 ${
                    spirit ? 'border-vermillion bg-white' : 'border-dashed border-gray-400 bg-gray-100'
                  } min-h-[80px] flex flex-col justify-center items-center`}
                >
                  {spirit && baseSpirit ? (
                    <>
                      <p className="text-sm font-bold parchment-text text-center truncate w-full">
                        {baseSpirit.name}
                      </p>
                      <p className="text-xs parchment-text opacity-75">Lv. {spirit.level}</p>
                      <button
                        onClick={() => handleRemoveFromParty(spirit.instanceId)}
                        className="mt-1 p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </button>
                    </>
                  ) : (
                    <p className="text-xs parchment-text opacity-50">Empty Slot</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-4">
          <div className="flex-1 scroll-container pr-2">
            <h3 className="font-bold parchment-text mb-2 sticky top-0 bg-parchment py-2">
              All Spirits ({spirits.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {spirits.map((spirit) => {
                const baseSpirit = getBaseSpirit(spirit.spiritId);
                if (!baseSpirit) return null;

                const element = getElement(baseSpirit.element);
                const lineage = getLineage(baseSpirit.lineage);
                const isInParty = activeParty.includes(spirit.instanceId);

                return (
                  <div
                    key={spirit.instanceId}
                    onClick={() => setSelectedSpirit(spirit)}
                    className={`p-3 rounded-lg cursor-pointer spirit-card ${
                      spirit.isPrismatic ? 'prismatic-border' : 'border-2 border-amber-700'
                    } ${
                      selectedSpirit?.instanceId === spirit.instanceId ? 'ring-2 ring-blue-500' : ''
                    }`}
                    style={{ background: 'var(--parchment)' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold parchment-text text-sm truncate flex-1">
                        {baseSpirit.name}
                      </h4>
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded ml-1 flex-shrink-0"
                        style={{ background: getRarityColor(baseSpirit.rarity), color: 'white' }}
                      >
                        {baseSpirit.rarity[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs parchment-text space-y-1">
                      <div className="flex justify-between">
                        <span className={`element-${element.id}`}>{element.name}</span>
                        <span>Lv. {spirit.level}</span>
                      </div>
                      <div className="text-xs opacity-75">{lineage.name}</div>
                      {!isInParty && activeParty.length < 4 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToParty(spirit.instanceId);
                          }}
                          className="w-full mt-2 p-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Party
                        </button>
                      )}
                      {isInParty && (
                        <div className="w-full mt-2 p-1 bg-blue-600 text-white rounded text-xs font-semibold text-center">
                          In Party
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {spirits.length === 0 && (
              <div className="text-center py-12 parchment-text opacity-50">
                <p>No spirits summoned yet</p>
                <p className="text-sm mt-2">Summon spirits to build your collection</p>
              </div>
            )}
          </div>

          {selectedSpirit && (
            <div className="w-80 p-4 bg-amber-50 rounded border-2 border-amber-700 scroll-container">
              {(() => {
                const baseSpirit = getBaseSpirit(selectedSpirit.spiritId);
                if (!baseSpirit) return null;

                const element = getElement(baseSpirit.element);
                const lineage = getLineage(baseSpirit.lineage);
                const stats = calculateAllStats(selectedSpirit);
                const skills = getAvailableSkills(selectedSpirit);

                return (
                  <>
                    <h3 className="text-xl font-bold parchment-text mb-1">{baseSpirit.name}</h3>
                    <div className="flex gap-2 mb-3">
                      <span
                        className="text-xs font-bold px-2 py-1 rounded"
                        style={{ background: getRarityColor(baseSpirit.rarity), color: 'white' }}
                      >
                        {baseSpirit.rarity.toUpperCase()}
                      </span>
                      {selectedSpirit.isPrismatic && (
                        <span className="text-xs font-bold px-2 py-1 rounded prismatic-border">
                          PRISMATIC
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold parchment-text text-sm mb-1">Details</h4>
                        <div className="text-sm parchment-text space-y-1">
                          <div className="flex justify-between">
                            <span>Level:</span>
                            <span className="font-semibold">{selectedSpirit.level}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Element:</span>
                            <span className={`element-${element.id} font-semibold`}>{element.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Lineage:</span>
                            <span className="font-semibold">{lineage.name}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold parchment-text text-sm mb-1">Essence</h4>
                        <div className="text-sm parchment-text space-y-1">
                          <div className="flex justify-between items-center">
                            <span>{baseSpirit.name} Essence:</span>
                            <span className="font-semibold text-purple-700">
                              {getEssenceCount(baseSpirit.id)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold parchment-text text-sm mb-1">Combat Stats</h4>
                        <div className="text-sm parchment-text space-y-1">
                          <div className="flex justify-between">
                            <span>Attack:</span>
                            <span
                              className="font-semibold"
                              style={{ color: getPotentialColor(selectedSpirit.potentialFactors.attack) }}
                            >
                              {stats.attack} [{selectedSpirit.potentialFactors.attack}]
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Defense:</span>
                            <span
                              className="font-semibold"
                              style={{ color: getPotentialColor(selectedSpirit.potentialFactors.defense) }}
                            >
                              {stats.defense} [{selectedSpirit.potentialFactors.defense}]
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Health:</span>
                            <span
                              className="font-semibold"
                              style={{ color: getPotentialColor(selectedSpirit.potentialFactors.health) }}
                            >
                              {stats.health} [{selectedSpirit.potentialFactors.health}]
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Affinity:</span>
                            <span
                              className="font-semibold"
                              style={{ color: getPotentialColor(selectedSpirit.potentialFactors.elementalAffinity) }}
                            >
                              {stats.elementalAffinity} [{selectedSpirit.potentialFactors.elementalAffinity}]
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold parchment-text text-sm mb-1">Passive Ability</h4>
                        <p className="text-sm parchment-text">
                          +10% {baseSpirit.passiveAbility.toUpperCase()}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold parchment-text text-sm mb-1">Skills</h4>
                        <div className="space-y-2">
                          {skills.map((skill) => (
                            <div key={skill.id} className="p-2 bg-white rounded border border-amber-300">
                              <p className="font-semibold parchment-text text-xs">{skill.name}</p>
                              <p className="text-xs parchment-text opacity-75">{skill.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t-2 border-amber-300">
                        {(() => {
                          const levelUpCost = getLevelUpCost(selectedSpirit.level);
                          const essenceCount = getEssenceCount(baseSpirit.id);
                          const canLevelUp = qi >= levelUpCost.qi && essenceCount >= levelUpCost.essence;
                          const harmonizeReward = 5 + (selectedSpirit.level * 2);

                          return (
                            <>
                              <button
                                onClick={() => handleLevelUp(selectedSpirit.instanceId)}
                                disabled={!canLevelUp}
                                className={`w-full p-2 rounded font-semibold text-sm flex items-center justify-center gap-2 ${
                                  canLevelUp
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <ArrowUp className="w-4 h-4" />
                                Level Up (Lv.{selectedSpirit.level} → {selectedSpirit.level + 1})
                              </button>
                              <div className="text-xs parchment-text text-center space-y-0.5">
                                <div className={qi >= levelUpCost.qi ? 'text-green-700' : 'text-red-600'}>
                                  Cost: {levelUpCost.qi} Qi {qi < levelUpCost.qi && '(Insufficient)'}
                                </div>
                                <div className={essenceCount >= levelUpCost.essence ? 'text-green-700' : 'text-red-600'}>
                                  Cost: {levelUpCost.essence} {baseSpirit.name} Essence {essenceCount < levelUpCost.essence && '(Insufficient)'}
                                </div>
                              </div>

                              <button
                                onClick={() => setShowHarmonizeConfirm(true)}
                                className="w-full p-2 rounded font-semibold text-sm flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
                              >
                                <Sparkles className="w-4 h-4" />
                                Harmonize Spirit
                              </button>
                              <div className="text-xs parchment-text text-center text-purple-700">
                                Gain +{harmonizeReward} {baseSpirit.name} Essence
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {showHarmonizeConfirm && selectedSpirit && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="parchment-bg chinese-border p-6 rounded-lg max-w-md">
              <h3 className="text-xl font-bold parchment-text mb-4 text-center">Harmonize Spirit?</h3>
              <p className="text-sm parchment-text mb-4 text-center">
                This will permanently remove{' '}
                <span className="font-bold">{getBaseSpirit(selectedSpirit.spiritId)?.name}</span> from your
                collection and grant you{' '}
                <span className="font-bold text-purple-700">
                  {5 + (selectedSpirit.level * 2)} {getBaseSpirit(selectedSpirit.spiritId)?.name} Essence
                </span>
                .
              </p>
              <p className="text-sm parchment-text mb-6 text-center font-semibold text-red-700">
                This action cannot be undone!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowHarmonizeConfirm(false)}
                  className="flex-1 p-2 rounded font-semibold text-sm bg-gray-300 text-gray-700 hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleHarmonize(selectedSpirit.instanceId)}
                  className="flex-1 p-2 rounded font-semibold text-sm bg-purple-600 text-white hover:bg-purple-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {levelUpAnimation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="parchment-bg chinese-border p-8 rounded-lg max-w-lg relative overflow-hidden"
              >
                {/* Particle effects */}
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ 
                        x: '50%', 
                        y: '50%', 
                        scale: 0,
                        opacity: 1 
                      }}
                      animate={{ 
                        x: `${50 + Math.cos((i / 12) * Math.PI * 2) * 200}%`,
                        y: `${50 + Math.sin((i / 12) * Math.PI * 2) * 200}%`,
                        scale: [0, 1, 0],
                        opacity: [1, 1, 0]
                      }}
                      transition={{ 
                        duration: 1.5,
                        delay: i * 0.05,
                        ease: "easeOut"
                      }}
                      className="absolute w-3 h-3 bg-blue-500 rounded-full"
                      style={{ 
                        boxShadow: '0 0 10px 2px rgba(59, 130, 246, 0.5)',
                        filter: 'blur(1px)'
                      }}
                    />
                  ))}
                </div>

                {/* Glowing background */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 0.3, scale: 1 }}
                  className="absolute inset-0 bg-gradient-radial from-blue-400 via-transparent to-transparent"
                  style={{ filter: 'blur(40px)' }}
                />

                <div className="relative z-10">
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center mb-6"
                  >
                    <TrendingUp className="w-16 h-16 mx-auto mb-3 text-blue-600" />
                    <h3 className="text-3xl font-bold parchment-text mb-2">
                      Level Up!
                    </h3>
                    <p className="text-xl font-semibold parchment-text">
                      {getBaseSpirit(levelUpAnimation.spirit.spiritId)?.name}
                    </p>
                    <motion.p
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="text-lg font-bold text-blue-700 mt-2"
                    >
                      Lv.{levelUpAnimation.oldLevel} → Lv.{levelUpAnimation.newLevel}
                    </motion.p>
                  </motion.div>

                  {/* Stats comparison */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-amber-50 rounded-lg p-4 mb-6 border-2 border-amber-300"
                  >
                    <h4 className="font-bold parchment-text text-center mb-3">Stat Changes</h4>
                    <div className="space-y-2">
                      {Object.entries(levelUpAnimation.stats).map(([stat, values], index) => {
                        const increase = values.new - values.old;
                        return (
                          <motion.div
                            key={stat}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + index * 0.1 }}
                            className="flex justify-between items-center"
                          >
                            <span className="font-semibold parchment-text capitalize">
                              {stat === 'elementalAffinity' ? 'Affinity' : stat}:
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{values.old}</span>
                              <span className="text-gray-400">→</span>
                              <motion.span
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                                className="font-bold text-green-700"
                              >
                                {values.new}
                              </motion.span>
                              <motion.span
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + index * 0.1 }}
                                className="text-green-600 font-semibold text-sm"
                              >
                                +{increase}
                              </motion.span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    onClick={closeLevelUpAnimation}
                    className="w-full p-3 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors"
                  >
                    Continue
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
