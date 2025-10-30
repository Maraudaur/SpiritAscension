import { useState, useEffect } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { useAudio } from '@/lib/stores/useAudio';
import { getBaseSpirit, getElement, calculateAllStats, getAvailableSkills, getSkill } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Swords, ArrowLeftRight, Heart, Shield, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PlayerSpirit } from '@shared/types';

type ActionMenu = 'none' | 'skills' | 'swap';

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
  const { spirits, activeParty, winBattle, updateSpiritHealth, battleRewardMultiplier } = useGameState();
  const { playDamage, playHeal, playButtonClick, playButtonHover, isMuted, toggleMute } = useAudio();
  const [battleState, setBattleState] = useState<'setup' | 'fighting' | 'victory' | 'defeat'>('setup');
  const [activePartySlot, setActivePartySlot] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerSpirits, setPlayerSpirits] = useState<BattleSpirit[]>([]);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [battleRewards, setBattleRewards] = useState<{ qi: number; qiGeneration: number } | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenu>('none');
  const [isBlocking, setIsBlocking] = useState(false);
  const [playerHealthBarShake, setPlayerHealthBarShake] = useState(false);
  const [enemyHealthBarShake, setEnemyHealthBarShake] = useState(false);
  const [playerHealthBarHeal, setPlayerHealthBarHeal] = useState(false);

  const generateNewEnemy = (spiritList: BattleSpirit[]) => {
    if (spiritList.length === 0) return null;
    
    // Find highest level spirit in active party
    const highestLevel = Math.max(...spiritList.map(s => s.playerSpirit.level));
    // Enemy level is within 2 levels of highest spirit (can be -2 to +2, minimum 1)
    const levelOffset = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, or 2
    const enemyLevel = Math.max(1, highestLevel + levelOffset);
    
    const enemyNames = ['Shadow Beast', 'Dark Serpent', 'Rogue Phantom', 'Chaos Wolf', 'Storm Drake'];
    const randomName = enemyNames[Math.floor(Math.random() * enemyNames.length)];
    
    const newEnemy: Enemy = {
      id: 'enemy_' + Date.now(),
      name: randomName,
      level: enemyLevel,
      attack: 80 + enemyLevel * 20,
      defense: 60 + enemyLevel * 15,
      maxHealth: 200 + enemyLevel * 50,
      currentHealth: 200 + enemyLevel * 50,
    };
    
    return newEnemy;
  };

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

    const newEnemy = generateNewEnemy(spiritsInBattle);
    if (newEnemy) {
      setEnemy(newEnemy);
      setBattleLog([`A wild ${newEnemy.name} (Lv. ${newEnemy.level}) appears!`]);
    }
  }, [activeParty, spirits]);

  const startBattle = () => {
    if (playerSpirits.length === 0) return;
    setBattleState('fighting');
    setBattleRewards(null);
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
    
    // Play damage sound and shake enemy health bar
    playDamage();
    setEnemyHealthBarShake(true);
    setTimeout(() => setEnemyHealthBarShake(false), 500);
    
    addLog(`${baseSpirit.name} used ${skill.name}! Dealt ${damage} damage.`);

    if (skill.healing > 0) {
      const healing = Math.floor(damage * skill.healing);
      const newHealth = Math.min(activeSpirit.maxHealth, activeSpirit.currentHealth + healing);
      setPlayerSpirits(prev => prev.map((s, i) => 
        i === activePartySlot ? { ...s, currentHealth: newHealth } : s
      ));
      
      // Play heal sound and glow player health bar
      playHeal();
      setPlayerHealthBarHeal(true);
      setTimeout(() => setPlayerHealthBarHeal(false), 600);
      
      addLog(`${baseSpirit.name} healed ${healing} HP!`);
    }

    setEnemy({ ...enemy, currentHealth: newEnemyHealth });

    if (newEnemyHealth <= 0) {
      setTimeout(() => {
        setBattleState('victory');
        addLog('Victory! The enemy has been defeated!');
        
        // Calculate rewards based on enemy level and multiplier
        const baseQiReward = enemy.level * 10;
        const qiReward = Math.floor(baseQiReward * battleRewardMultiplier);
        const qiGenerationIncrease = 0.1;
        setBattleRewards({ qi: qiReward, qiGeneration: qiGenerationIncrease });
        
        // Heal all spirits to full health in both local state and game state
        setPlayerSpirits(prev => prev.map(spirit => ({
          ...spirit,
          currentHealth: spirit.maxHealth
        })));
        
        playerSpirits.forEach(spirit => {
          updateSpiritHealth(spirit.playerSpirit.instanceId, spirit.maxHealth);
        });
        
        // Update game state with battle rewards
        winBattle(qiReward);
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
    let damage = Math.max(1, Math.floor(enemy.attack - (stats.defense * 0.3)));
    
    // Apply blocking damage reduction
    if (isBlocking) {
      damage = Math.floor(damage * 0.5);
      addLog(`${getBaseSpirit(target.playerSpirit.spiritId)?.name} blocked! Damage reduced.`);
      setIsBlocking(false);
    }
    
    const newHealth = Math.max(0, target.currentHealth - damage);

    // Play damage sound and shake player health bar
    playDamage();
    setPlayerHealthBarShake(true);
    setTimeout(() => setPlayerHealthBarShake(false), 500);

    setPlayerSpirits(prev => prev.map((s, i) => 
      i === targetIndex ? { ...s, currentHealth: newHealth } : s
    ));

    const targetBase = getBaseSpirit(target.playerSpirit.spiritId);
    addLog(`${enemy.name} attacks ${targetBase?.name}! Dealt ${damage} damage.`);

    if (newHealth <= 0) {
      addLog(`${targetBase?.name} has been defeated!`);
      
      // Check if there are any other living spirits (after this one is defeated)
      const hasLivingSpirit = playerSpirits.some((s, i) => 
        i !== targetIndex && s.currentHealth > 0
      );
      
      if (!hasLivingSpirit) {
        // No living spirits left - defeat
        setTimeout(() => {
          setBattleState('defeat');
          addLog('All spirits have been defeated...');
        }, 800);
      } else {
        // Auto-swap to next living spirit
        setTimeout(() => {
          const nextAliveIndex = playerSpirits.findIndex((s, i) => 
            i !== targetIndex && s.currentHealth > 0
          );
          if (nextAliveIndex !== -1) {
            const nextSpirit = getBaseSpirit(playerSpirits[nextAliveIndex].playerSpirit.spiritId);
            setActivePartySlot(nextAliveIndex);
            addLog(`${nextSpirit?.name} enters the battle!`);
          }
        }, 800);
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
    setActionMenu('none');
    setIsBlocking(false);
    addLog(`Swapped ${oldSpirit?.name} for ${newSpirit?.name}!`);
    
    setTimeout(() => enemyTurn(), 800);
  };

  const handleBlock = () => {
    if (battleState !== 'fighting') return;
    
    const activeSpirit = playerSpirits[activePartySlot];
    if (!activeSpirit || activeSpirit.currentHealth <= 0) return;
    
    const baseSpirit = getBaseSpirit(activeSpirit.playerSpirit.spiritId);
    setIsBlocking(true);
    setActionMenu('none');
    addLog(`${baseSpirit?.name} takes a defensive stance!`);
    
    setTimeout(() => enemyTurn(), 800);
  };

  const handleSkillSelect = (skillId: string) => {
    setActionMenu('none');
    handleAttack(skillId);
  };

  const handleContinueBattle = () => {
    // Generate new enemy based on current player spirits
    const newEnemy = generateNewEnemy(playerSpirits);
    if (!newEnemy) return;
    
    setEnemy(newEnemy);
    setBattleState('fighting');
    setBattleRewards(null);
    setActivePartySlot(0);
    setActionMenu('none');
    setIsBlocking(false);
    addLog(`A wild ${newEnemy.name} (Lv. ${newEnemy.level}) appears!`);
    addLog('The battle continues!');
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
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            title={isMuted ? "Unmute Sound" : "Mute Sound"}
            className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          
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
        
        <button onClick={handleClose} className="absolute top-4 right-4 parchment-text hover:opacity-70 z-10">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-center mb-4 parchment-text brush-stroke">
          Cultivation Battle
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
            <h3 className="font-bold parchment-text mb-2 text-blue-800">Your Spirit</h3>
            {activeSpirit && activeBaseSpirit && activeStats ? (
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
                  <motion.div 
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: playerHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="bg-green-600 h-4 rounded-full transition-all"
                      style={{ width: `${(activeSpirit.currentHealth / activeSpirit.maxHealth) * 100}%` }}
                      animate={{
                        boxShadow: playerHealthBarHeal 
                          ? ['0 0 0px rgba(34, 197, 94, 0)', '0 0 15px rgba(34, 197, 94, 0.8)', '0 0 0px rgba(34, 197, 94, 0)']
                          : '0 0 0px rgba(34, 197, 94, 0)'
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
              <p className="text-sm parchment-text opacity-50">No active spirit</p>
            )}
          </div>

          {/* Enemy Spirit Info */}
          <div className="p-4 bg-amber-50 rounded-lg border-2 border-red-600">
            <h3 className="font-bold parchment-text mb-2 text-red-800">Enemy</h3>
            {enemy ? (
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
                  <motion.div 
                    className="w-full bg-gray-300 rounded-full h-4 overflow-hidden"
                    animate={{
                      x: enemyHealthBarShake ? [0, -4, 4, -4, 4, 0] : 0,
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <div
                      className="bg-red-600 h-4 rounded-full transition-all"
                      style={{ width: `${(enemy.currentHealth / enemy.maxHealth) * 100}%` }}
                    />
                  </motion.div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm parchment-text">
                  <div>ATK: {enemy.attack}</div>
                  <div>DEF: {enemy.defense}</div>
                </div>
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
              <p key={index} className="opacity-75">&gt; {log}</p>
            ))}
          </div>
        </div>

        {/* Action Buttons and Submenus */}
        {battleState === 'setup' && (
          <Button
            onClick={startBattle}
            className="w-full p-4 text-lg font-bold"
            style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
          >
            Begin Battle
          </Button>
        )}

        {battleState === 'fighting' && activeSpirit && activeSpirit.currentHealth > 0 && (
          <div>
            {actionMenu === 'none' && (
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={() => {
                    playButtonClick();
                    availableSkills.length > 0 && handleSkillSelect(availableSkills[0].id);
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
                    setActionMenu('skills');
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
                    setActionMenu('swap');
                  }}
                  onMouseEnter={playButtonHover}
                  className="p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-2"
                >
                  <ArrowLeftRight className="w-6 h-6" />
                  <span>Swap</span>
                </button>
              </div>
            )}

            {actionMenu === 'skills' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold parchment-text text-lg">Select Skill</h3>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu('none');
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
                      <p className="text-xs opacity-90">{skill.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {actionMenu === 'swap' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold parchment-text text-lg">Swap Spirit</h3>
                  <button
                    onClick={() => {
                      playButtonClick();
                      setActionMenu('none');
                    }}
                    onMouseEnter={playButtonHover}
                    className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-semibold"
                  >
                    Back
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {playerSpirits.map((spirit, index) => {
                    const baseSpirit = getBaseSpirit(spirit.playerSpirit.spiritId);
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
                        className={`p-3 rounded-lg border-2 text-left ${
                          isActive ? 'border-blue-600 bg-blue-100 cursor-not-allowed' : 
                          isDead ? 'border-gray-400 bg-gray-200 opacity-50 cursor-not-allowed' :
                          'border-green-600 bg-white hover:bg-green-50'
                        }`}
                      >
                        <p className="text-sm font-bold parchment-text truncate">{baseSpirit?.name}</p>
                        <p className="text-xs parchment-text">Lv. {spirit.playerSpirit.level}</p>
                        <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
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
            )}
          </div>
        )}

        {battleState === 'victory' && battleRewards && (
          <div className="p-4 bg-green-100 rounded-lg border-2 border-green-600">
            <h3 className="font-bold text-green-800 text-2xl mb-3 text-center">🎉 Victory! 🎉</h3>
            <p className="text-md text-green-800 mb-3 text-center font-semibold">
              You defeated the enemy! A new challenger approaches...
            </p>
            <div className="mb-4 space-y-2 p-3 bg-white rounded border border-green-400">
              <p className="text-lg font-bold text-green-800">Battle Rewards:</p>
              <p className="text-md text-green-800">✦ +{battleRewards.qi} Qi</p>
              <p className="text-md text-green-800">✦ +{battleRewards.qiGeneration.toFixed(1)} to Qi generation per second</p>
              <p className="text-sm text-green-700 mt-2 italic">
                All spirits have been fully healed!
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleContinueBattle}
                className="w-full font-bold"
                style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
              >
                Continue Battling
              </Button>
              <Button
                onClick={handleClose}
                className="w-full font-bold"
                style={{ background: 'var(--jade-green)', color: 'var(--parchment)' }}
              >
                Return to Cultivation
              </Button>
            </div>
          </div>
        )}

        {battleState === 'defeat' && (
          <div className="p-4 bg-red-100 rounded-lg border-2 border-red-600">
            <h3 className="font-bold text-red-800 text-2xl mb-3 text-center">Defeat...</h3>
            <p className="text-md text-red-800 mb-2 text-center">
              All your spirits have been defeated.
            </p>
            <p className="text-sm text-red-700 mb-4 text-center italic">
              Return to cultivation and strengthen your spirits before trying again.
            </p>
            <Button
              onClick={handleClose}
              className="w-full font-bold"
              style={{ background: 'var(--vermillion)', color: 'var(--parchment)' }}
            >
              Return to Cultivation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
