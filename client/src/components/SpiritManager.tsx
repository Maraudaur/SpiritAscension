import { useState, useEffect, useMemo } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useAudio } from "@/lib/stores/useAudio";
import {
  getBaseSpirit,
  getElement,
  getLineage,
  getRarityColor,
  getPotentialColor,
  calculateAllStats,
  getAvailableSkills,
  getPassiveAbility,
  getPrimaryElement,
  getElementColor,
} from "@/lib/spiritUtils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowUp,
  Sparkles,
  TrendingUp,
  Filter,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PlayerSpirit, ElementId } from "@shared/types";
import { SpiritSpriteAnimation } from "./SpiritSpriteAnimation";

interface SpiritManagerProps {
  onClose?: () => void;
}

interface StatComparison {
  attack: { old: number; new: number };
  defense: { old: number; new: number };
  health: { old: number; new: number };
  affinity: { old: number; new: number };
  agility: { old: number; new: number };
}

export function SpiritManager({ onClose }: SpiritManagerProps = {}) {
  const {
    spirits,
    activeParty,
    qi,
    addToParty,
    removeFromParty,
    levelUpSpirit,
    harmonizeSpirit,
    getEssenceCount,
    getLevelUpCost,
    ftueStep,
    setFtueStep,
    freeLevelUp,
    hasAddedToPartyAfterFirstSummon,
    summonCount,
  } = useGameState();
  const [selectedSpirit, setSelectedSpirit] = useState<PlayerSpirit | null>(
    null,
  );
  const [showHarmonizeConfirm, setShowHarmonizeConfirm] = useState(false);
  const [levelUpAnimation, setLevelUpAnimation] = useState<{
    spirit: PlayerSpirit;
    oldLevel: number;
    newLevel: number;
    stats: StatComparison;
  } | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null,
  );
  
  // Filter and sort state
  const [elementFilter, setElementFilter] = useState<string>("all");
  const [lineageFilter, setLineageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);
  
  // FTUE: Auto-select first spirit when highlightFirstSpirit is active
  useEffect(() => {
    if (ftueStep === "highlightFirstSpirit" && spirits.length > 0 && !selectedSpirit) {
      setSelectedSpirit(spirits[0]);
      setFtueStep("highlightLevelUpButton");
    }
  }, [ftueStep, spirits, selectedSpirit, setFtueStep]);
  
  // Apply filters and sorting
  const filteredAndSortedSpirits = useMemo(() => {
    let filtered = [...spirits];
    
    // Apply element filter
    if (elementFilter !== "all") {
      filtered = filtered.filter((spirit) => {
        const baseSpirit = getBaseSpirit(spirit.spiritId);
        return baseSpirit?.elements.includes(elementFilter as ElementId);
      });
    }
    
    // Apply lineage filter
    if (lineageFilter !== "all") {
      filtered = filtered.filter((spirit) => {
        const baseSpirit = getBaseSpirit(spirit.spiritId);
        return baseSpirit?.lineage === lineageFilter;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const baseA = getBaseSpirit(a.spiritId);
      const baseB = getBaseSpirit(b.spiritId);
      if (!baseA || !baseB) return 0;
      
      switch (sortBy) {
        case "name":
          return baseA.name.localeCompare(baseB.name);
        case "level":
          return b.level - a.level;
        case "rarity": {
          const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, boss: 5 };
          return (rarityOrder[baseB.rarity] || 0) - (rarityOrder[baseA.rarity] || 0);
        }
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [spirits, elementFilter, lineageFilter, sortBy]);

  const handleAddToParty = (instanceId: string) => {
    addToParty(instanceId);
  };

  const handleRemoveFromParty = (instanceId: string) => {
    removeFromParty(instanceId);
  };

  const handleLevelUp = (instanceId: string) => {
    const spirit = spirits.find((s) => s.instanceId === instanceId);
    if (!spirit) return;

    const oldStats = calculateAllStats(spirit);
    const oldLevel = spirit.level;
    levelUpSpirit(instanceId);
    const newSpirit = { ...spirit, level: spirit.level + 1 };
    const newStats = calculateAllStats(newSpirit);

    const statComparison: StatComparison = {
      attack: { old: oldStats.attack, new: newStats.attack },
      defense: { old: oldStats.defense, new: newStats.defense },
      health: { old: oldStats.health, new: newStats.health },
      affinity: { old: oldStats.affinity, new: newStats.affinity },
      agility: { old: oldStats.agility, new: newStats.agility },
    };

    setLevelUpAnimation({
      spirit: newSpirit,
      oldLevel,
      newLevel: newSpirit.level,
      stats: statComparison,
    });

    const audio = new Audio("/sounds/success.mp3");
    audio.volume = 0.6;
    audio.play();
    setAudioElement(audio);
    
    // Clear FTUE step after leveling up during story node 1 flow
    if (ftueStep === "highlightLevelUpButton") {
      setFtueStep(null);
    }
  };

  const closeLevelUpAnimation = () => {
    if (levelUpAnimation) {
      const updatedSpirit = spirits.find(
        (s) => s.instanceId === levelUpAnimation.spirit.instanceId,
      );
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
    <div className="w-full h-full flex" style={{ background: "#F5E6D3" }}>
      {/* LEFT PANEL: Active Party (Fixed) */}
      <div
        className="w-80 flex-shrink-0 p-6 flex flex-col border-r-4"
        style={{
          background: "linear-gradient(135deg, #E8D4B8 0%, #D4B896 100%)",
          borderColor: "#8B4513",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#5D4037" }}
          >
            Active Party
          </h2>
          <span
            className="text-sm font-bold px-3 py-1 rounded-full"
            style={{
              background: activeParty.length === 4 ? "#2E7D32" : "#C1272D",
              color: "white",
            }}
          >
            {activeParty.length}/4
          </span>
        </div>

        <div className="flex-1 overflow-y-auto scroll-container space-y-3">
          {[0, 1, 2, 3].map((index) => {
            const spiritInstanceId = activeParty[index];
            const spirit = spirits.find(
              (s) => s.instanceId === spiritInstanceId,
            );
            const baseSpirit = spirit ? getBaseSpirit(spirit.spiritId) : null;
            const lineage =
              spirit && baseSpirit ? getLineage(baseSpirit.lineage) : null;

            // Highlight first spirit in party during FTUE
            const shouldHighlight = ftueStep === "highlightFirstSpirit" && index === 0 && spirit;
            
            return (
              <div
                key={index}
                onClick={() => spirit && setSelectedSpirit(spirit)}
                className={`p-3 rounded-lg border-2 ${
                  spirit
                    ? "bg-white shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                    : "border-dashed border-gray-400 bg-gray-100"
                } ${shouldHighlight ? "animate-pulse-bright" : ""} min-h-[140px] flex flex-col justify-between`}
                style={{ borderColor: spirit ? "#8B4513" : undefined }}
              >
                {spirit && baseSpirit && lineage ? (
                  <>
                    <div className="flex gap-3 mb-2">
                      <img
                        src="/icons/placeholdericon.png"
                        alt={baseSpirit.name}
                        className="w-16 h-16 object-contain flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold parchment-text text-sm truncate">
                          {baseSpirit.name}
                        </h4>
                        <div className="text-xs parchment-text opacity-75">
                          Lv. {spirit.level}
                        </div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {baseSpirit.elements.map((elemId) => {
                            const elem = getElement(elemId);
                            const isNeutral = elemId === "none";
                            return (
                              <span
                                key={elemId}
                                className="text-xs font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: getElementColor(elemId),
                                  color: isNeutral ? "#000000" : "white",
                                }}
                              >
                                {elem?.name}
                              </span>
                            );
                          })}
                          <span className="text-xs" style={{ color: "#8B4513" }}>
                            | {lineage.name}
                          </span>
                        </div>
                        <span
                          className="inline-block text-xs font-bold px-2 py-0.5 rounded mt-1"
                          style={{
                            background: getRarityColor(baseSpirit.rarity),
                            color: "white",
                          }}
                        >
                          {baseSpirit.rarity.charAt(0).toUpperCase() + baseSpirit.rarity.slice(1)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromParty(spirit.instanceId);
                      }}
                      className="w-full p-2 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs parchment-text opacity-50">
                      Empty Slot
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN PANEL: Spirit Inventory (Scrollable) */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        <h2
          className="text-3xl font-bold mb-4 tracking-tight"
          style={{ color: "#5D4037" }}
        >
          Spirit Inventory
        </h2>

        <div className="text-sm mb-4 px-3 py-2 rounded-lg border-2" style={{ background: "#E8D4B8", borderColor: "#8B4513", color: "#5D4037" }}>
          <span className="font-bold">{filteredAndSortedSpirits.length}</span> of <span className="font-bold">{spirits.length}</span> spirits shown
        </div>

        {/* Filter and Sort Controls */}
        <div className="mb-4 p-4 rounded-lg border-2 shadow-md" style={{ background: "#E8D4B8", borderColor: "#8B4513" }}>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5" style={{ color: "#8B4513" }} />
            <span className="font-bold parchment-text">Filter & Sort</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs parchment-text font-bold mb-1.5 block">
                Element
              </label>
              <Select value={elementFilter} onValueChange={setElementFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold border-2 text-[#1A1A1A]" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectItem value="all">All Elements</SelectItem>
                  <SelectItem value="wood">Wood</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="earth">Earth</SelectItem>
                  <SelectItem value="metal">Metal</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs parchment-text font-bold mb-1.5 block">
                Lineage
              </label>
              <Select value={lineageFilter} onValueChange={setLineageFilter}>
                <SelectTrigger className="h-9 text-xs font-semibold border-2 text-[#1A1A1A]" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectItem value="all">All Lineages</SelectItem>
                  <SelectItem value="tiger">Tiger</SelectItem>
                  <SelectItem value="dragon">Dragon</SelectItem>
                  <SelectItem value="ox">Ox</SelectItem>
                  <SelectItem value="serpent">Serpent</SelectItem>
                  <SelectItem value="horse">Horse</SelectItem>
                  <SelectItem value="monkey">Monkey</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs parchment-text font-bold mb-1.5 block">
                Sort By
              </label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9 text-xs font-semibold border-2 text-[#1A1A1A]" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2" style={{ background: "#F5E6D3", borderColor: "#1A1A1A" }}>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="level">Level</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Spirit Grid */}
        <div className="flex-1 overflow-y-auto scroll-container">
          <div className="grid grid-cols-3 gap-4">
            {filteredAndSortedSpirits.map((spirit) => {
              const baseSpirit = getBaseSpirit(spirit.spiritId);
              if (!baseSpirit) return null;

              const lineage = getLineage(baseSpirit.lineage);
              const isInParty = activeParty.includes(spirit.instanceId);
              
              // Count filled party slots (non-null spirits)
              const filledPartySlots = activeParty.filter(id => id !== null).length;
              
              // FTUE: Highlight first spirit
              const isFirstSpirit = spirits[0]?.instanceId === spirit.instanceId;
              const shouldHighlight = ftueStep === "highlightFirstSpirit" && isFirstSpirit;

              return (
                <div
                  key={spirit.instanceId}
                  onClick={() => setSelectedSpirit(spirit)}
                  className={`p-4 rounded-lg cursor-pointer border-2 hover:shadow-lg transition-shadow ${
                    spirit.isPrismatic
                      ? "prismatic-border"
                      : ""
                  } ${shouldHighlight ? "animate-pulse-bright" : ""}`}
                  style={{ 
                    background: "#FFFFFF",
                    borderColor: spirit.isPrismatic ? undefined : "#8B4513"
                  }}
                >
                  <div className="flex flex-col items-center">
                    <img
                      src="/icons/placeholdericon.png"
                      alt={baseSpirit.name}
                      className="w-24 h-24 object-contain mb-2"
                    />
                    <h4 className="font-bold parchment-text text-sm text-center">
                      {baseSpirit.name}
                    </h4>
                    <div className="text-xs parchment-text opacity-75 mb-1">
                      Lv. {spirit.level}
                    </div>
                    <div className="flex items-center gap-1 mb-2 flex-wrap justify-center">
                      {baseSpirit.elements.map((elemId) => {
                        const elem = getElement(elemId);
                        const isNeutral = elemId === "none";
                        return (
                          <span
                            key={elemId}
                            className="text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: getElementColor(elemId),
                              color: isNeutral ? "#000000" : "white",
                            }}
                          >
                            {elem?.name}
                          </span>
                        );
                      })}
                      <span className="text-xs" style={{ color: "#8B4513" }}>
                        | {lineage.name}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded mb-2"
                      style={{
                        background: getRarityColor(baseSpirit.rarity),
                        color: "white",
                      }}
                    >
                      {baseSpirit.rarity.charAt(0).toUpperCase() + baseSpirit.rarity.slice(1)}
                    </span>
                    {!isInParty && filledPartySlots < 4 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToParty(spirit.instanceId);
                        }}
                        className={`w-full p-1.5 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 flex items-center justify-center gap-1 ${
                          summonCount === 1 && !hasAddedToPartyAfterFirstSummon
                            ? "animate-pulse-bright"
                            : ""
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        Add to Party
                      </button>
                    )}
                    {isInParty && (
                      <div className="w-full p-1.5 bg-blue-600 text-white rounded text-xs font-semibold text-center">
                        In Party
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filteredAndSortedSpirits.length === 0 && spirits.length > 0 && (
            <div className="text-center py-12 parchment-text opacity-50">
              <p>No spirits match the selected filters</p>
              <p className="text-sm mt-2">
                Try adjusting your filter settings
              </p>
            </div>
          )}
          {spirits.length === 0 && (
            <div className="text-center py-12 parchment-text opacity-50">
              <p>No spirits summoned yet</p>
              <p className="text-sm mt-2">
                Summon spirits to build your collection
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LAYER 2: Spirit Detail Modal */}
      <Dialog open={selectedSpirit !== null && !levelUpAnimation} onOpenChange={(open) => {
        if (!open) {
          setSelectedSpirit(null);
          setShowHarmonizeConfirm(false);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[85vh] parchment-bg" style={{ background: "#F5E6D3" }}>
          {selectedSpirit && (() => {
            const baseSpirit = getBaseSpirit(selectedSpirit.spiritId);
            if (!baseSpirit) return null;

            const lineage = getLineage(baseSpirit.lineage);
            const stats = calculateAllStats(selectedSpirit);
            const skills = getAvailableSkills(selectedSpirit);

            return (
              <div className="flex flex-col gap-4" style={{ maxHeight: "80vh" }}>
                {/* Close Button */}
                <button
                  onClick={() => {
                    setSelectedSpirit(null);
                    setShowHarmonizeConfirm(false);
                  }}
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
                    {selectedSpirit.isPrismatic && (
                      <span className="text-xs font-bold px-2 py-1 rounded border-2 prismatic-border" style={{ borderColor: "#8B4513" }}>
                        PRISMATIC
                      </span>
                    )}
                    <span className="text-xs parchment-text bg-white px-2 py-1 rounded border-2" style={{ borderColor: "#8B4513" }}>
                      Level {selectedSpirit.level}
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
                  {/* LEFT COLUMN: Spirit Sprite + Essence */}
                  <div className="flex flex-col items-center justify-between gap-4 py-2">
                    <div className="flex items-center justify-center flex-1 min-h-0">
                      <SpiritSpriteAnimation
                        spiritId={baseSpirit.id}
                        position="left"
                        size={200}
                        isTakingDamage={false}
                        isDefeated={false}
                      />
                    </div>
                    <div className="w-full p-3 rounded-lg border-2 flex-shrink-0" style={{ background: "#FFFFFF", borderColor: "#8B4513" }}>
                      <h4 className="font-bold parchment-text text-sm mb-2 text-center">
                        Essence
                      </h4>
                      <div className="text-center">
                        <span className="font-bold text-purple-700 text-2xl">
                          {getEssenceCount(baseSpirit.id)}
                        </span>
                        <p className="text-xs parchment-text mt-1">
                          {baseSpirit.name} Essence
                        </p>
                      </div>
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
                          <span
                            className="font-semibold"
                            style={{
                              color: getPotentialColor(
                                selectedSpirit.potentialFactors.attack,
                              ),
                            }}
                          >
                            {stats.attack} [
                            {selectedSpirit.potentialFactors.attack}]
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Defense:</span>
                          <span
                            className="font-semibold"
                            style={{
                              color: getPotentialColor(
                                selectedSpirit.potentialFactors.defense,
                              ),
                            }}
                          >
                            {stats.defense} [
                            {selectedSpirit.potentialFactors.defense}]
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health:</span>
                          <span
                            className="font-semibold"
                            style={{
                              color: getPotentialColor(
                                selectedSpirit.potentialFactors.health,
                              ),
                            }}
                          >
                            {stats.health} [
                            {selectedSpirit.potentialFactors.health}]
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agility:</span>
                          <span
                            className="font-semibold"
                            style={{
                              color: getPotentialColor(
                                selectedSpirit.potentialFactors.agility,
                              ),
                            }}
                          >
                            {stats.agility} [
                            {selectedSpirit.potentialFactors.agility}]
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Affinity:</span>
                          <span
                            className="font-semibold"
                            style={{
                              color: getPotentialColor(
                                selectedSpirit.potentialFactors
                                  .affinity,
                              ),
                            }}
                          >
                            {stats.affinity} [
                            {
                              selectedSpirit.potentialFactors
                                .affinity
                            }
                            ]
                          </span>
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
                        {skills.map((skill) => {
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

                {/* Bottom Row: Action Buttons */}
                <div className="pt-3 border-t-2 space-y-3" style={{ borderColor: "#8B4513" }}>
                  {(() => {
                    const levelUpCost = getLevelUpCost(
                      selectedSpirit.level,
                    );
                    const essenceCount = getEssenceCount(baseSpirit.id);
                    const canLevelUp =
                      freeLevelUp ||
                      (qi >= levelUpCost.qi &&
                      essenceCount >= levelUpCost.essence);
                    const harmonizeReward = 5 + selectedSpirit.level * 2;

                    return (
                      <>
                        {!showHarmonizeConfirm ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <button
                                onClick={() =>
                                  handleLevelUp(selectedSpirit.instanceId)
                                }
                                disabled={!canLevelUp}
                                className={`w-full p-3 rounded font-bold flex items-center justify-center gap-2 ${
                                  canLevelUp
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                } ${ftueStep === "highlightLevelUpButton" ? "animate-pulse-bright" : ""}`}
                              >
                                <ArrowUp className="w-4 h-4" />
                                Level Up (Lv.{selectedSpirit.level} →{" "}
                                {selectedSpirit.level + 1})
                              </button>
                              <div className="text-xs parchment-text space-y-0.5">
                                <div
                                  className={
                                    qi >= levelUpCost.qi
                                      ? "text-green-700"
                                      : "text-red-600"
                                  }
                                >
                                  Cost: {levelUpCost.qi} Qi{" "}
                                  {qi < levelUpCost.qi && "(Insufficient)"}
                                </div>
                                <div
                                  className={
                                    essenceCount >= levelUpCost.essence
                                      ? "text-green-700"
                                      : "text-red-600"
                                  }
                                >
                                  Cost: {levelUpCost.essence} {baseSpirit.name}{" "}
                                  Essence{" "}
                                  {essenceCount < levelUpCost.essence &&
                                    "(Insufficient)"}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <button
                                onClick={() => setShowHarmonizeConfirm(true)}
                                className="w-full p-3 rounded font-bold flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
                              >
                                <Sparkles className="w-4 h-4" />
                                Harmonize Spirit
                              </button>
                              <div className="text-xs parchment-text text-purple-700">
                                Gain +{harmonizeReward} {baseSpirit.name}{" "}
                                Essence
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border-2 border-red-600 bg-red-50">
                            <p className="text-sm parchment-text mb-2 text-center">
                              Permanently remove{" "}
                              <span className="font-bold">
                                {baseSpirit.name}
                              </span>{" "}
                              for{" "}
                              <span className="font-bold text-purple-700">
                                {harmonizeReward} {baseSpirit.name} Essence
                              </span>
                              ?
                            </p>
                            <p className="text-xs parchment-text mb-3 text-center font-semibold text-red-700">
                              This cannot be undone!
                            </p>
                            <div className="flex gap-2">
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
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Level Up Animation */}
      <AnimatePresence>
        {levelUpAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="parchment-bg chinese-border p-8 rounded-lg max-w-lg relative overflow-hidden"
            >
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: "50%",
                      y: "50%",
                      scale: 0,
                      opacity: 1,
                    }}
                    animate={{
                      x: `${50 + Math.cos((i / 12) * Math.PI * 2) * 200}%`,
                      y: `${50 + Math.sin((i / 12) * Math.PI * 2) * 200}%`,
                      scale: [0, 1, 0],
                      opacity: [1, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.05,
                      ease: "easeOut",
                    }}
                    className="absolute w-3 h-3 bg-blue-500 rounded-full"
                    style={{
                      boxShadow: "0 0 10px 2px rgba(59, 130, 246, 0.5)",
                      filter: "blur(1px)",
                    }}
                  />
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.3, scale: 1 }}
                className="absolute inset-0 bg-gradient-radial from-blue-400 via-transparent to-transparent"
                style={{ filter: "blur(40px)" }}
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
                    Lv.{levelUpAnimation.oldLevel} → Lv.
                    {levelUpAnimation.newLevel}
                  </motion.p>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="bg-amber-50 rounded-lg p-4 mb-6 border-2 border-amber-300"
                >
                  <h4 className="font-bold parchment-text text-center mb-3">
                    Stat Changes
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(levelUpAnimation.stats).map(
                      ([stat, values], index) => {
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
                              {stat === "affinity"
                                ? "Affinity"
                                : stat}
                              :
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">
                                {values.old}
                              </span>
                              <span className="text-gray-400">→</span>
                              <motion.span
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{
                                  delay: 0.6 + index * 0.1,
                                  duration: 0.4,
                                }}
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
                      },
                    )}
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
  );
}
