import { useState, useEffect } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { Sparkles, Swords, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MainScreenProps {
  onNavigate: (screen: 'main' | 'spirits' | 'battle' | 'summon') => void;
}

export function MainScreen({ onNavigate }: MainScreenProps) {
  const { qi, qiPerSecond, updateQi, qiUpgrades, upgradeQiProduction, battlesWon } = useGameState();
  const [displayQi, setDisplayQi] = useState(qi);

  useEffect(() => {
    const interval = setInterval(() => {
      updateQi();
    }, 100);

    return () => clearInterval(interval);
  }, [updateQi]);

  useEffect(() => {
    setDisplayQi(qi);
  }, [qi]);

  const upgradeCost = 500 * (qiUpgrades.baseProduction + 1);
  const canUpgrade = qi >= upgradeCost;

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="parchment-bg chinese-border max-w-2xl w-full p-8 rounded-lg">
        <h1 className="text-5xl font-bold text-center mb-2 parchment-text brush-stroke">
          天道修真
        </h1>
        <p className="text-2xl text-center mb-8 parchment-text">Ascension</p>

        <div className="mb-8 p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg chinese-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl parchment-text font-bold">Qi Energy</span>
            <span className="text-3xl font-bold qi-glow" style={{ color: 'var(--imperial-gold)' }}>
              {Math.floor(displayQi)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm parchment-text opacity-75">Generation Rate</span>
            <span className="text-lg parchment-text font-semibold">
              {qiPerSecond.toFixed(1)} / sec
            </span>
          </div>
        </div>

        <div className="mb-6 p-4 parchment-bg rounded border-2 border-amber-700">
          <h3 className="text-lg font-bold parchment-text mb-3">Cultivation Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between parchment-text text-sm">
              <span>Base Production:</span>
              <span className="font-semibold">{qiUpgrades.baseProduction}</span>
            </div>
            <div className="flex justify-between parchment-text text-sm">
              <span>Multiplier:</span>
              <span className="font-semibold">{qiUpgrades.multiplier.toFixed(1)}x</span>
            </div>
            <div className="flex justify-between parchment-text text-sm">
              <span>Battles Won:</span>
              <span className="font-semibold">{battlesWon}</span>
            </div>
          </div>
          <Button
            onClick={upgradeQiProduction}
            disabled={!canUpgrade}
            className="w-full mt-4"
            style={{
              background: canUpgrade ? 'var(--vermillion)' : '#999',
              color: 'var(--parchment)',
            }}
          >
            Enhance Cultivation ({upgradeCost} Qi)
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Button
            onClick={() => onNavigate('summon')}
            className="p-6 flex flex-col items-center gap-2"
            style={{ background: 'var(--jade-green)', color: 'var(--parchment)' }}
          >
            <Sparkles className="w-8 h-8" />
            <span className="text-sm font-semibold">Summon Spirit</span>
          </Button>

          <Button
            onClick={() => onNavigate('spirits')}
            className="p-6 flex flex-col items-center gap-2"
            style={{ background: 'var(--azure)', color: 'var(--parchment)' }}
          >
            <Users className="w-8 h-8" />
            <span className="text-sm font-semibold">Manage Spirits</span>
          </Button>

          <Button
            onClick={() => onNavigate('battle')}
            className="p-6 flex flex-col items-center gap-2"
            style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
          >
            <Swords className="w-8 h-8" />
            <span className="text-sm font-semibold">Enter Battle</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
