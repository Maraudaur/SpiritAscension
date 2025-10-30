import { useState, useEffect } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { getBaseSpirit, getElement, calculateAllStats, getAvailableSkills, getSkill } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Swords, ArrowLeftRight, Heart } from 'lucide-react';
import type { PlayerSpirit } from '@shared/types';

interface BattleScreenProps {
  onClose: () => void;
}

interface BattleSpirit {
  playerSpirit: PlayerSpirit;
  currentHealth: number;
  maxHealth: number;
}

interface Enemy {
  id: string;
  name: string;
  level: number;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
}

export function BattleScreen({ onClose }: BattleScreenProps) {
  const { spirits, activeParty, winBattle, updateSpiritHealth } = useGameState();
  const [battleState, setBattleState] = useState<'setup' | 'fighting' | 'victory' | 'defeat'>('setup');
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [enemy, setEnemy] = useState<Enemy | null>(null);

  useEffect(() => {
    if (activeParty.length === 0) {
      setBattleLog(['No spirits in active party! Please add spirits to your party first.']);
      return;
    }

    const spiritsInBattle = activeParty
      .map(instanceId => spirits.find(s => s.instanceId === instanceId))
      .filter((s): s is PlayerSpirit => s !== undefined)
      .map(spirit => {
        const stats = calculateAllStats(spirit);
        return {
          playerSpirit: spirit,
          currentHealth: spirit.currentHealth ?? stats.health,
          maxHealth: stats.health,
        };
      });

    setPlayerSpirits(spiritsInBattle);

    const enemyLevel = 1 + Math.floor(Math.random() * 3);
    const newEnemy: Enemy = {
      id: 'enemy_' + Date.now(),
      name: 'Shadow Beast',
      level: enemyLevel,
      attack: 80 + enemyLevel * 20,
      defense: 60 + enemyLevel * 15,
      maxHealth: 200 + enemyLevel * 50,
      currentHealth: 200 + enemyLevel * 50,
    };
    setEnemy(newEnemy);

    setBattleLog([`A wild ${newEnemy.name} (Lv. ${enemyLevel}) appears!`]);
  }, [activeParty, spirits]);

  const startBattle = () => {
    if (playerSpirits.length === 0) return;
    setBattleState('fighting');
    addLog('Battle begins!');
  };

  const addLog = (message: string) => {
    setBattleLog(prev => [...prev, message]);
  };

  const handleAttack = (skillId: string) => {
    if (!enemy || battleState !== 'fighting' || playerSpirits.length === 0) return;

    const activeSpirit = playerSpirits[activePartySlot];
    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;

    const skill = getSkill(skillId);
    const stats = calculateAllStats(activeSpirit.playerSpirit);
    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);
    
    if (!skill || !baseSpirit) return;

    const damage = Math.max(1, Math.floor((stats.attack * skill.damage) - (enemy.defense * 0.3)));
    const newEnemyHealth = Math.max(0, enemy.currentHealth - damage);
    
    addLog(`${baseSpirit.name} used ${skill.name}! Dealt ${damage} damage.`);

    if (skill.healing > 0) {
      const healing = Math.floor(damage * skill.healing);
      const newHealth = Math.min(activeSpirit.maxHealth, activeSpirit.currentHealth + healing);
      setPlayerSpirits(prev => prev.map((s, i) => 
        i === activePartySlot ? { ...s, currentHealth: newHealth } : s
      ));
      addLog(`${baseSpirit.name} healed ${healing} HP!`);
    }

    setEnemy({ ...enemy, currentHealth: newEnemyHealth });

    if (newEnemyHealth <= 0) {
      setTimeout(() => {
        setBattleState('victory');
        addLog('Victory! The enemy has been defeated!');
        winBattle();
        playerSpirits.forEach(spirit => {
          updateSpiritHealth(spirit.playerSpirit.instanceId, spirit.currentHealth);
        });
      }, 500);
      return;
    }

    setTimeout(() => enemyTurn(), 800);
  };

  const enemyTurn = () => {
    if (!enemy || playerSpirits.length === 0) return;

    let targetIndex = activePartySlot;
    while (targetIndex < playerSpirits.length && playerSpirits[targetIndex].currentHealth <= 0) {
      targetIndex++;
    }

    if (targetIndex >= playerSpirits.length) {
      setBattleState('defeat');
      addLog('All spirits have been defeated...');
      return;
    }

    const target = playerSpirits[targetIndex];
    const stats = calculateAllStats(target.playerSpirit);
    const damage = Math.max(1, Math.floor(enemy.attack - (stats.defense * 0.3)));
    const newHealth = Math.max(0, target.currentHealth - damage);

    setPlayerSpirits(prev => prev.map((s, i) => 
      i === targetIndex ? { ...s, currentHealth: newHealth } : s
    ));

    const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
    addLog(`${enemy.name} attacks ${targetBase?.name}! Dealt ${damage} damage.`);

    if (newHealth <= 0) {
      addLog(`${targetBase?.name} has been defeated!`);
      
      const allDefeated = playerSpirits.every((s, i) => 
        i === targetIndex ? newHealth <= 0 : s.currentHealth <= 0
      );

      if (allDefeated) {
        setTimeout(() => {
          setBattleState('defeat');
          addLog('All spirits have been defeated...');
        }, 500);
      }
    }
  };

  const handleSwap = (index: number) => {
    if (battleState !== 'fighting' || index === activePartySlot) return;
    if (playerSpirits[index].currentHealth <= 0) {
      addLog('Cannot swap to a defeated spirit!');
      return;
    }

    const oldSpirit = getBaseSpirit(playerSpirits[activePartySlot].playerSpirit.spiritId);
    const newSpirit = getBaseSpirit(playerSpirits[index].playerSpirit.spiritId);
    
    setActivePartySlot(index);
    addLog(`Swapped ${oldSpirit?.name} for ${newSpirit?.name}!`);
    
    setTimeout(() => enemyTurn(), 800);
  };

  const handleClose = () => {
    playerSpirits.forEach(spirit => {
      updateSpiritHealth(spirit.playerSpirit.instanceId, spirit.currentHealth);
    });
    onClose();
  };

  if (activeParty.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
        <div className="parchment-bg chinese-border max-w-md w-full p-8 rounded-lg relative">
          <button onClick={onClose} className="absolute top-4 right-4 parchment-text hover:opacity-70">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-center mb-4 parchment-text">Cannot Start Battle</h2>
          <p className="parchment-text text-center">
            You need to add spirits to your active party before entering battle!
          </p>
          <Button onClick={onClose} className="w-full mt-4" style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}>
            Return
          </Button>
        </div>
      </div>
    );
  }

  const activeSpirit = playerSpirits[activePartySlot];
  const activeBaseSpirit = activeSpirit ? getBaseSpirit(activeSpirit.playerSpirit.spiritId) : null;
  const activeStats = activeSpirit ? calculateAllStats(activeSpirit.playerSpirit) : null;
  const availableSkills = activeSpirit ? getAvailableSkills(activeSpirit.playerSpirit) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-5xl w-full h-[90vh] p-6 rounded-lg relative flex flex-col">
        <button onClick={handleClose} className="absolute top-4 right-4 parchment-text hover:opacity-70 z-10">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-4 parchment-text brush-stroke">
          Cultivation Battle
        </h2>

        <div className="flex-1 grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded border-2 border-amber-700">
              <h3 className="font-bold parchment-text mb-2 flex items-center gap-2">
                <Swords className="w-5 h-5" />
                Enemy
              </h3>
              {enemy && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold parchment-text text-lg">{enemy.name}</span>
                    <span className="text-sm parchment-text">Lv. {enemy.level}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm parchment-text mb-1">
                      <span>HP</span>
                      <span>{enemy.currentHealth} / {enemy.maxHealth}</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-4">
                      <div
                        className="bg-red-600 h-4 rounded-full transition-all"
                        style={{ width: `${(enemy.currentHealth / enemy.maxHealth) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                    <div>ATK: {enemy.attack}</div>
                    <div>DEF: {enemy.defense}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-amber-50 rounded border-2 border-amber-700">
              <h3 className="font-bold parchment-text mb-2">Active Spirit</h3>
              {activeSpirit && activeBaseSpirit && activeStats && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold parchment-text text-lg">{activeBaseSpirit.name}</span>
                    <span className="text-sm parchment-text">Lv. {activeSpirit.playerSpirit.level}</span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-sm parchment-text mb-1">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" /> HP
                      </span>
                      <span>{activeSpirit.currentHealth} / {activeSpirit.maxHealth}</span>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-4">
                      <div
                        className="bg-green-600 h-4 rounded-full transition-all"
                        style={{ width: `${(activeSpirit.currentHealth / activeSpirit.maxHealth) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm parchment-text mb-3">
                    <div>ATK: {activeStats.attack}</div>
                    <div>DEF: {activeStats.defense}</div>
                  </div>

                  {battleState === 'fighting' && activeSpirit.currentHealth > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold parchment-text">Skills:</p>
                      {availableSkills.map((skill) => (
                        <Button
                          key={skill.id}
                          onClick={() => handleAttack(skill.id)}
                          className="w-full text-sm"
                          style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
                        >
                          {skill.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-amber-50 rounded border-2 border-amber-700">
              <h3 className="font-bold parchment-text mb-2 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Party
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {playerSpirits.map((spirit, index) => {
                  const baseSpirit = getBaseSpirit(spirit.playerSpirit.spiritId);
                  const isActive = index === activePartySlot;
                  const isDead = spirit.currentHealth <= 0;

                  return (
                    <button
                      key={spirit.playerSpirit.instanceId}
                      onClick={() => handleSwap(index)}
                      disabled={isDead || battleState !== 'fighting' || isActive}
                      className={`p-2 rounded border-2 text-left ${
                        isActive ? 'border-blue-600 bg-blue-50' : 
                        isDead ? 'border-gray-400 bg-gray-200 opacity-50' :
                        'border-amber-700 bg-white hover:bg-amber-50'
                      }`}
                    >
                      <p className="text-xs font-bold parchment-text truncate">{baseSpirit?.name}</p>
                      <div className="w-full bg-gray-300 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${isDead ? 'bg-gray-500' : 'bg-green-600'}`}
                          style={{ width: `${(spirit.currentHealth / spirit.maxHealth) * 100}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex-1 p-4 bg-amber-50 rounded border-2 border-amber-700 scroll-container mb-4">
              <h3 className="font-bold parchment-text mb-2">Battle Log</h3>
              <div className="space-y-1 text-sm parchment-text">
                {battleLog.map((log, index) => (
                  <p key={index} className="opacity-75">&gt; {log}</p>
                ))}
              </div>
            </div>

            {battleState === 'setup' && (
              <Button
                onClick={startBattle}
                className="w-full p-4 text-lg font-bold"
                style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
              >
                Begin Battle
              </Button>
            )}

            {battleState === 'victory' && (
              <div className="p-4 bg-green-100 rounded border-2 border-green-600">
                <h3 className="font-bold text-green-800 text-xl mb-2">Victory!</h3>
                <p className="text-sm text-green-800 mb-3">
                  You have gained Qi and improved your cultivation multiplier!
                </p>
                <Button
                  onClick={handleClose}
                  className="w-full"
                  style={{ background: 'var(--jade-green)', color: 'var(--parchment)' }}
                >
                  Return to Cultivation
                </Button>
              </div>
            )}

            {battleState === 'defeat' && (
              <div className="p-4 bg-red-100 rounded border-2 border-red-600">
                <h3 className="font-bold text-red-800 text-xl mb-2">Defeat</h3>
                <p className="text-sm text-red-800 mb-3">
                  Your spirits need to recover. Return and try again when stronger.
                </p>
                <Button
                  onClick={handleClose}
                  className="w-full"
                  style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
                >
                  Return to Cultivation
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
