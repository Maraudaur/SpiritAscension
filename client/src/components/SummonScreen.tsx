import { useState, useEffect } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { useAudio } from '@/lib/stores/useAudio';
import { getBaseSpirit, getElement, getLineage, getRarityColor, getPotentialColor, calculateAllStats } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerSpirit, Rarity } from '@shared/types';

interface SummonScreenProps {
  onClose: () => void;
}

type SummonStage = 'idle' | 'channeling' | 'revealing' | 'revealed';

const RARITY_GLOW_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',
  uncommon: '#10B981',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

export function SummonScreen({ onClose }: SummonScreenProps) {
  const { summonSpirit, spendQi, getSpiritCost } = useGameState();
  const { isMuted, toggleMute } = useAudio();
  const [summonedSpirit, setSummonedSpirit] = useState<PlayerSpirit | null>(null);
  const [stage, setStage] = useState<SummonStage>('idle');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const spiritCost = getSpiritCost();

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  const handleSummon = () => {
    if (spendQi(spiritCost)) {
      setStage('channeling');
      
      // Channeling phase (1.5 seconds)
      setTimeout(() => {
        const spirit = summonSpirit();
        setSummonedSpirit(spirit);
        setStage('revealing');
        
        // Play sound based on rarity
        const baseSpirit = getBaseSpirit(spirit.spiritId);
        if (baseSpirit) {
          const audio = new Audio('/sounds/success.mp3');
          audio.volume = 0.5;
          audio.play();
          setAudioElement(audio);
        }
        
        // Reveal phase (2 seconds to show rarity glow)
        setTimeout(() => {
          setStage('revealed');
        }, 2000);
      }, 1500);
    }
  };

  const handleContinue = () => {
    setSummonedSpirit(null);
    setStage('idle');
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
  };

  const baseSpirit = summonedSpirit ? getBaseSpirit(summonedSpirit.spiritId) : null;
  const element = baseSpirit ? getElement(baseSpirit.element) : null;
  const lineage = baseSpirit ? getLineage(baseSpirit.lineage) : null;
  const stats = summonedSpirit ? calculateAllStats(summonedSpirit) : null;
  const rarityColor = baseSpirit ? RARITY_GLOW_COLORS[baseSpirit.rarity] : '#FFF';

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
          Spirit Summoning Circle
        </h2>

        <AnimatePresence mode="wait">
          {stage === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="mb-6">
                <div className="w-48 h-48 mx-auto rounded-full border-4 border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                  <Sparkles className="w-24 h-24" style={{ color: 'var(--imperial-gold)' }} />
                </div>
              </div>

              <div className="mb-6 parchment-text space-y-2">
                <p className="text-lg font-semibold">Summon a new spirit to aid your cultivation</p>
                <p className="text-sm opacity-75">Cost: {spiritCost} Qi</p>
              </div>

              <div className="mb-6 p-4 bg-amber-50 rounded border-2 border-amber-300">
                <h3 className="font-bold parchment-text mb-2">Summoning Rates</h3>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor('common') }}>Common:</span>
                    <span>60%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor('uncommon') }}>Uncommon:</span>
                    <span>25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor('rare') }}>Rare:</span>
                    <span>10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor('epic') }}>Epic:</span>
                    <span>4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: getRarityColor('legendary') }}>Legendary:</span>
                    <span>1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="prismatic-border px-1 rounded">Prismatic:</span>
                    <span>0.1%</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSummon}
                className="w-full p-6 text-lg font-bold"
                style={{ background: 'var(--jade-green)', color: 'var(--parchment)' }}
              >
                Summon Spirit
              </Button>
            </motion.div>
          )}

          {stage === 'channeling' && (
            <motion.div
              key="channeling"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-48 h-48 mx-auto rounded-full border-4 border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center"
              >
                <Sparkles className="w-24 h-24" style={{ color: 'var(--imperial-gold)' }} />
              </motion.div>
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-xl parchment-text mt-6 font-bold"
              >
                Channeling Qi...
              </motion.p>
            </motion.div>
          )}

          {stage === 'revealing' && baseSpirit && (
            <motion.div
              key="revealing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  transition={{ duration: 0.8 }}
                  className="w-64 h-64 mx-auto rounded-full flex items-center justify-center relative"
                  style={{
                    background: `radial-gradient(circle, ${rarityColor}40, ${rarityColor}10, transparent)`,
                  }}
                >
                  {/* Animated particles */}
                  {[...Array(summonedSpirit?.isPrismatic ? 12 : 8)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        x: Math.cos((i / (summonedSpirit?.isPrismatic ? 12 : 8)) * Math.PI * 2) * 120,
                        y: Math.sin((i / (summonedSpirit?.isPrismatic ? 12 : 8)) * Math.PI * 2) * 120,
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                      className="absolute w-3 h-3 rounded-full"
                      style={{
                        background: summonedSpirit?.isPrismatic
                          ? `linear-gradient(45deg, #ff0080, #7928ca, #0070f3, #00dfd8)`
                          : rarityColor,
                        boxShadow: `0 0 10px ${rarityColor}`,
                      }}
                    />
                  ))}
                  
                  <motion.div
                    animate={{
                      boxShadow: [
                        `0 0 20px ${rarityColor}`,
                        `0 0 60px ${rarityColor}`,
                        `0 0 20px ${rarityColor}`,
                      ],
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={`w-32 h-32 rounded-full flex items-center justify-center ${summonedSpirit?.isPrismatic ? 'prismatic-border' : 'border-4'}`}
                    style={{
                      borderColor: summonedSpirit?.isPrismatic ? undefined : rarityColor,
                      background: summonedSpirit?.isPrismatic
                        ? 'linear-gradient(45deg, #ff008030, #7928ca30, #0070f330, #00dfd830)'
                        : `${rarityColor}20`,
                    }}
                  >
                    <Sparkles
                      className="w-16 h-16"
                      style={{ color: summonedSpirit?.isPrismatic ? '#FFD700' : rarityColor }}
                    />
                  </motion.div>
                </motion.div>
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <motion.h3
                  animate={{
                    textShadow: [
                      `0 0 10px ${rarityColor}`,
                      `0 0 20px ${rarityColor}`,
                      `0 0 10px ${rarityColor}`,
                    ],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-3xl font-bold mb-2"
                  style={{ color: rarityColor }}
                >
                  {baseSpirit.rarity.toUpperCase()}
                  {summonedSpirit?.isPrismatic && ' - PRISMATIC!'}
                </motion.h3>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {stage === 'revealed' && summonedSpirit && baseSpirit && element && lineage && stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className={`p-6 rounded-lg ${summonedSpirit.isPrismatic ? 'prismatic-border' : 'border-2 border-amber-700'}`}>
              <div className="text-center mb-4">
                <h3 className="text-2xl font-bold parchment-text mb-1">{baseSpirit.name}</h3>
                <div className="flex items-center justify-center gap-3">
                  <span
                    className="text-sm font-bold px-3 py-1 rounded"
                    style={{ background: getRarityColor(baseSpirit.rarity), color: 'white' }}
                  >
                    {baseSpirit.rarity.toUpperCase()}
                  </span>
                  {summonedSpirit.isPrismatic && (
                    <span className="text-sm font-bold px-3 py-1 rounded prismatic-border">
                      PRISMATIC
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="parchment-text">
                  <span className="font-semibold">Element: </span>
                  <span className={`element-${element.id}`}>{element.name}</span>
                </div>
                <div className="parchment-text">
                  <span className="font-semibold">Lineage: </span>
                  <span>{lineage.name}</span>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="font-bold parchment-text mb-2">Base Stats (Level 1)</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between parchment-text">
                    <span>Attack:</span>
                    <span className="font-semibold" style={{ color: getPotentialColor(summonedSpirit.potentialFactors.attack) }}>
                      {stats.attack} [{summonedSpirit.potentialFactors.attack}]
                    </span>
                  </div>
                  <div className="flex justify-between parchment-text">
                    <span>Defense:</span>
                    <span className="font-semibold" style={{ color: getPotentialColor(summonedSpirit.potentialFactors.defense) }}>
                      {stats.defense} [{summonedSpirit.potentialFactors.defense}]
                    </span>
                  </div>
                  <div className="flex justify-between parchment-text">
                    <span>Health:</span>
                    <span className="font-semibold" style={{ color: getPotentialColor(summonedSpirit.potentialFactors.health) }}>
                      {stats.health} [{summonedSpirit.potentialFactors.health}]
                    </span>
                  </div>
                  <div className="flex justify-between parchment-text">
                    <span>Affinity:</span>
                    <span className="font-semibold" style={{ color: getPotentialColor(summonedSpirit.potentialFactors.elementalAffinity) }}>
                      {stats.elementalAffinity} [{summonedSpirit.potentialFactors.elementalAffinity}]
                    </span>
                  </div>
                </div>
              </div>

              <div className="parchment-text text-sm">
                <span className="font-semibold">Passive: </span>
                <span>+10% {baseSpirit.passiveAbility.toUpperCase()}</span>
              </div>
            </div>

            <Button
              onClick={handleContinue}
              className="w-full p-4 text-lg font-bold"
              style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
            >
              Continue
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
