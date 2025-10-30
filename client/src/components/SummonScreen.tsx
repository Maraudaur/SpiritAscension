import { useState } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { getBaseSpirit, getElement, getLineage, getRarityColor, getPotentialColor, calculateAllStats } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Sparkles } from 'lucide-react';
import type { PlayerSpirit } from '@shared/types';

interface SummonScreenProps {
  onClose: () => void;
}

export function SummonScreen({ onClose }: SummonScreenProps) {
  const { summonSpirit, spendQi, getSpiritCost } = useGameState();
  const [summonedSpirit, setSummonedSpirit] = useState<PlayerSpirit | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const spiritCost = getSpiritCost();

  const handleSummon = () => {
    if (spendQi(spiritCost)) {
      setIsAnimating(true);
      setTimeout(() => {
        const spirit = summonSpirit();
        setSummonedSpirit(spirit);
        setIsAnimating(false);
      }, 1000);
    }
  };

  const handleContinue = () => {
    setSummonedSpirit(null);
  };

  const baseSpirit = summonedSpirit ? getBaseSpirit(summonedSpirit.spiritId) : null;
  const element = baseSpirit ? getElement(baseSpirit.element) : null;
  const lineage = baseSpirit ? getLineage(baseSpirit.lineage) : null;
  const stats = summonedSpirit ? calculateAllStats(summonedSpirit) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-2xl w-full p-8 rounded-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 parchment-text hover:opacity-70"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-6 parchment-text brush-stroke">
          Spirit Summoning Circle
        </h2>

        {!summonedSpirit && !isAnimating && (
          <div className="text-center">
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
          </div>
        )}

        {isAnimating && (
          <div className="text-center py-12">
            <div className="w-48 h-48 mx-auto rounded-full border-4 border-vermillion bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center animate-pulse">
              <Sparkles className="w-24 h-24 animate-spin" style={{ color: 'var(--imperial-gold)' }} />
            </div>
            <p className="text-xl parchment-text mt-6 font-bold">Channeling Qi...</p>
          </div>
        )}

        {summonedSpirit && baseSpirit && element && lineage && stats && (
          <div className="space-y-4">
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
          </div>
        )}
      </div>
    </div>
  );
}
