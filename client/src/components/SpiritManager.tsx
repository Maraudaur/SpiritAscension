import { useState } from 'react';
import { useGameState } from '@/lib/stores/useGameState';
import { getBaseSpirit, getElement, getLineage, getRarityColor, getPotentialColor, calculateAllStats, getAvailableSkills } from '@/lib/spiritUtils';
import { Button } from '@/components/ui/button';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PlayerSpirit } from '@shared/types';

interface SpiritManagerProps {
  onClose: () => void;
}

export function SpiritManager({ onClose }: SpiritManagerProps) {
  const { spirits, activeParty, addToParty, removeFromParty } = useGameState();
  const [selectedSpirit, setSelectedSpirit] = useState<PlayerSpirit | null>(null);

  const handleAddToParty = (instanceId: string) => {
    addToParty(instanceId);
  };

  const handleRemoveFromParty = (instanceId: string) => {
    removeFromParty(instanceId);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="parchment-bg chinese-border max-w-6xl w-full h-[90vh] p-6 rounded-lg relative flex flex-col">
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
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
