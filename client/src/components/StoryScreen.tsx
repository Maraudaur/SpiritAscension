import { useState, useEffect } from "react"; // <-- Import useEffect
import { Button } from "./ui/button";
import { BookOpen, ArrowRight, ArrowLeft, ChevronRight, Lock } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";
import storyData from "@shared/data/story.json";
import { motion, AnimatePresence } from "framer-motion";

interface StoryCharacter {
  id: string; // e.g., "OldMan"
  position: "left" | "right" | "center";
}

interface StoryDialogue {
  speakerId: string; // "OldMan", "Hero", or "Narrator"
  text: string;
  expression: string; // e.g., "happy", "angry", "neutral"
  background?: string;
}

interface StoryNode {
  id: number;
  title: string;
  description: string;
  summary?: string; // Plot summary for completed stories
  background: string; // Path to background image
  characters: StoryCharacter[]; // Characters in this scene
  dialogues: StoryDialogue[]; // Dialogues for this scene
  encounterId: string | null;
}

interface StoryScreenProps {
  onClose?: () => void;
  onNavigate?: (
    screen: "story" | "cultivation" | "spirits" | "summon" | "battle",
  ) => void;
}

function getPortraitPath(characterId: string, expression: string): string {
  // Use 'neutral' as a fallback if the specific expression doesn't exist
  return `/images/portraits/${characterId.toLowerCase()}/${expression}.png`;
}

// Character-specific style configuration
interface CharacterStyleConfig {
  maxHeight: string;
  verticalPos: string;
  transform: string;
}

const characterStyles: Record<string, CharacterStyleConfig> = {
  droplet: {
    maxHeight: "max-h-[30vh]",
    verticalPos: "top-[45%]",
    transform: "-translate-y-full",
  },
  oldman: {
    maxHeight: "max-h-[70vh]",
    verticalPos: "top-1/2",
    transform: "-translate-y-1/2",
  },
};

// Default styles for characters not in the configuration
const defaultCharacterStyle: CharacterStyleConfig = {
  maxHeight: "max-h-[70vh]",
  verticalPos: "top-1/2",
  transform: "-translate-y-1/2",
};

export function StoryScreen({ onClose, onNavigate }: StoryScreenProps) {
  // --- FIX: This line is new/modified ---
  const [storyLayer, setStoryLayer] = useState<"map" | "scene" | "summary">(() => {
    // This function now runs ONCE when the component loads
    // We check the global state:
    const initialNodeId = useGameState.getState().currentStoryNodeId;

    // If a node ID is set (e.g., 0), we are in a scene.
    // If it's null, we are on the map.
    return initialNodeId !== null ? "scene" : "map";
  });

  // --- FIX: REMOVED LOCAL STATE ---
  // const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  // const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);

  const {
    completedStoryNodes,
    completeStoryNode,
    isStoryNodeCompleted,
    setCurrentEncounterId,
    // --- FIX: USING GLOBAL STATE AS THE ONLY SOURCE OF TRUTH ---
    currentStoryNodeId,
    currentStoryDialogueIndex,
    hasUpgradedBase,
    activeParty,
    spirits,
    battlesWon,
    setStoryPosition, // <-- The action to update global state
    setFtueStep,
    ftueStep,
    setStoryBattleCheckpoint,
  } = useGameState();

  const storyNodes = storyData as StoryNode[];
  // --- FIX: Find node using global state ---
  const currentNode = storyNodes.find((n) => n.id === currentStoryNodeId);

  // --- FTUE EFFECT HOOK ---
  // This effect watches the global state and works correctly
  useEffect(() => {
    if (currentStoryNodeId === 0 && currentStoryDialogueIndex === 2) {
      setFtueStep("highlightCultivation");
    } else if (currentStoryNodeId === 0 && currentStoryDialogueIndex === 3) {
      setFtueStep("highlightSummon");
    } else if (currentStoryNodeId === 1 && currentStoryDialogueIndex === 0) {
      setFtueStep("highlightSpirits");
    } else if (currentStoryNodeId === 1 && currentStoryDialogueIndex === 1) {
      setFtueStep("highlightBattle");
    }
  }, [currentStoryNodeId, currentStoryDialogueIndex, setFtueStep]);

  const handleNodeClick = (nodeId: number) => {
    // --- FIX: Update global state ---
    setStoryPosition(nodeId, 0);
    
    // Check if this story node is already completed
    const isCompleted = isStoryNodeCompleted(nodeId);
    
    // If completed, show summary; otherwise show scene
    setStoryLayer(isCompleted ? "summary" : "scene");
  };

  const handleContinueDialogue = () => {
    if (!currentNode || currentStoryNodeId === null) return;

    if (currentStoryDialogueIndex < currentNode.dialogues.length - 1) {
      // --- FIX: Update global state ---
      setStoryPosition(currentStoryNodeId, currentStoryDialogueIndex + 1);
    } else {
      // Reached the end of dialogues
      handleNodeComplete();
    }
  };

  const handleNodeComplete = () => {
    if (currentStoryNodeId === null || !currentNode) return;

    const isNodeIncomplete = !isStoryNodeCompleted(currentStoryNodeId);

    // If node is incomplete AND has an encounter, trigger the battle
    if (isNodeIncomplete && currentNode.encounterId !== null) {
      // Set checkpoint for story battle retry flow
      setStoryBattleCheckpoint({
        nodeId: currentStoryNodeId,
        dialogueIndex: currentStoryDialogueIndex,
      });
      setCurrentEncounterId(currentNode.encounterId);
      setStoryLayer("map");
      // DON'T clear story position - preserve it for defeat retry
      if (onNavigate) {
        onNavigate("battle");
      }
    } else {
      // Node is already complete OR has no encounter - just return to map
      // Mark as complete if it wasn't already (for non-battle nodes)
      if (isNodeIncomplete) {
        completeStoryNode(currentStoryNodeId);
      }
      setStoryLayer("map");
      setStoryPosition(null, 0); // Reset story position
    }
  };

  const handleSkipToMap = () => {
    setStoryLayer("map");
    setStoryPosition(null, 0); // Reset story position
  };

  const getNextIncompleteNode = () => {
    return storyNodes.find((node) => !isStoryNodeCompleted(node.id));
  };

  const nextNode = getNextIncompleteNode();

  // --- RENDER LOGIC ---

  // --- RENDER SCENE VIEW ---
  if (storyLayer === "scene" && currentNode) {
    // --- FIX: All these variables now use the same global state ---
    const currentDialogue = currentNode.dialogues[currentStoryDialogueIndex];
    const isLastDialogue =
      currentStoryDialogueIndex === currentNode.dialogues.length - 1;

    // --- FTUE GATING LOGIC ---
    const hasNoSpiritsInParty = activeParty.every((slot) => slot === null);
    const hasLevel2Spirit = spirits.some((spirit) => spirit.level >= 2);
    const hasWonBattle = battlesWon >= 1;

    const isGated =
      (currentStoryNodeId === 0 &&
        currentStoryDialogueIndex === 2 &&
        !hasUpgradedBase) ||
      (currentStoryNodeId === 0 &&
        currentStoryDialogueIndex === 3 &&
        hasNoSpiritsInParty) ||
      (currentStoryNodeId === 1 &&
        currentStoryDialogueIndex === 0 &&
        !hasLevel2Spirit) ||
      (currentStoryNodeId === 1 &&
        currentStoryDialogueIndex === 1 &&
        !hasWonBattle);

    // This 'return' was missing, causing a syntax error
    return (
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* 1. Background Image */}
        {(() => {
          // This logic is now consistent
          const dialogueBg =
            currentNode.dialogues[currentStoryDialogueIndex].background;
          const backgroundToShow = dialogueBg ?? currentNode.background;

          return (
            <AnimatePresence>
              <motion.img
                key={backgroundToShow}
                src={backgroundToShow}
                alt="Scene background"
                className="absolute inset-0 w-full h-full object-cover z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            </AnimatePresence>
          );
        })()}
        {/* Upper 2/3: Scene and Characters */}
        <div className="flex-[2] flex justify-center p-8 relative overflow-hidden z-10">
          <div className="relative z-10 w-full h-full flex items-end justify-center">
            {currentNode.characters.map((character) => {
              // This logic is now consistent
              const currentDialogue =
                currentNode.dialogues[currentStoryDialogueIndex];

              const speakerHasSprite = currentNode.characters.some(
                (c) => c.id === currentDialogue.speakerId,
              );
              const isSpeaking =
                currentDialogue.speakerId.toLowerCase() ===
                character.id.toLowerCase();
              const expression = isSpeaking
                ? currentDialogue.expression
                : "neutral";
              const imagePath = getPortraitPath(character.id, expression);

              let targetOpacity = 0;
              if (speakerHasSprite) {
                targetOpacity = isSpeaking ? 1 : 0.6;
              }

              // Get character-specific styles or fall back to defaults
              const charId = character.id.toLowerCase();
              const styles = characterStyles[charId] || defaultCharacterStyle;

              return (
                <motion.div
                  key={character.id}
                  className={`absolute ${styles.verticalPos} ${styles.transform}`}
                  style={{
                    // @ts-ignore
                    "--position-x":
                      character.position === "left"
                        ? "-25%"
                        : character.position === "right"
                          ? "80%"
                          : "0%",
                  }}
                  animate={{
                    opacity: targetOpacity,
                    scale: isSpeaking ? 1.05 : 1,
                    y: isSpeaking ? -10 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <img
                    src={imagePath}
                    alt={character.id}
                    className={`${styles.maxHeight} object-contain`}
                    style={{
                      transform: `translateX(var(--position-x))`,
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Lower 1/3: Visual Novel Dialogue Box */}
        <div className="flex-[1] flex items-end p-6 relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStoryDialogueIndex} // <-- Use global index
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-5xl mx-auto"
            >
              <div
                className="p-6 rounded-lg border-4 shadow-2xl"
                style={{
                  background: "rgba(245, 230, 211, 0.95)",
                  borderColor: "#8B4513",
                }}
              >
                {/* Speaker Name */}
                <div
                  className="inline-block px-4 py-1 rounded mb-3 border-2"
                  style={{
                    background: "#C1272D",
                    color: "#F5E6D3",
                    borderColor: "#8B4513",
                    fontFamily: "serif",
                  }}
                >
                  <span className="font-bold text-lg">
                    {currentDialogue.speakerId}
                  </span>
                </div>

                {/* Dialogue Text */}
                <p
                  className="text-xl leading-relaxed mb-4"
                  style={{ color: "#5C4033", fontFamily: "serif" }}
                >
                  {currentDialogue.text}
                </p>

                {/* Progress Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {currentNode.dialogues.map((_, index) => (
                      <div
                        key={index}
                        className="w-3 h-3 rounded-full border"
                        style={{
                          background:
                            index <= currentStoryDialogueIndex // <-- Use global index
                              ? "#4C8477"
                              : "#999",
                          borderColor: "#5C4033",
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSkipToMap}
                      className="px-6 py-2"
                      variant="outline"
                      style={{
                        borderColor: "#8B4G13",
                        color: "#8B4513",
                      }}
                    >
                      Skip to Map
                    </Button>
                    <Button
                      onClick={handleContinueDialogue}
                      disabled={isGated} // This logic is now consistent
                      className={`px-6 py-2 flex items-center gap-2 ${
                        isGated ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      style={{
                        background: isGated ? "#999" : "#4C8477",
                        color: "#F5E6D3",
                      }}
                    >
                      {isLastDialogue ? ( // This logic is now consistent
                        currentNode.encounterId !== null ? (
                          <>
                            Begin Trial <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Complete <ArrowRight className="w-4 h-4" />
                          </>
                        )
                      ) : (
                        <>
                          Next <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // --- RENDER SUMMARY VIEW ---
  if (storyLayer === "summary" && currentNode) {
    return (
      <div
        className="w-full h-full overflow-y-auto flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #F5E6D3 0%, #E8D4B8 100%)",
        }}
      >
        <div className="max-w-4xl mx-auto p-8">
          <div
            className="p-8 rounded-lg border-4"
            style={{
              background: "#FFFFFF",
              borderColor: "#4C8477",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* Header with completion badge */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1
                  className="text-4xl font-bold mb-2"
                  style={{ color: "#8B4513", fontFamily: "serif" }}
                >
                  {currentNode.title}
                </h1>
              </div>
              <div
                className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                style={{
                  background: "rgba(76, 132, 119, 0.2)",
                  color: "#4C8477",
                  border: "2px solid #4C8477",
                }}
              >
                <span>✓</span>
                <span>Story Complete</span>
              </div>
            </div>

            {/* Story Summary */}
            <div className="mb-8">
              <p
                className="text-lg leading-relaxed"
                style={{ color: "#5C4033" }}
              >
                {currentNode.summary || currentNode.description}
              </p>
            </div>

            {/* Additional Info */}
            {currentNode.encounterId && (
              <div
                className="mb-8 p-4 rounded-lg"
                style={{
                  background: "rgba(212, 175, 55, 0.1)",
                  border: "2px solid #D4AF37",
                }}
              >
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#8B4513" }}
                >
                  ⚔️ This story unlocked a battle encounter
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => setStoryLayer("scene")}
                className="flex-1 px-6 py-3 flex items-center justify-center gap-2"
                style={{
                  background: "#4C8477",
                  color: "#F5E6D3",
                }}
              >
                <span>↻</span>
                <span>Replay Story</span>
              </Button>
              <Button
                onClick={handleSkipToMap}
                className="flex-1 px-6 py-3 flex items-center justify-center gap-2"
                style={{
                  background: "#8B4513",
                  color: "#F5E6D3",
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Map</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER MAP VIEW ---
  return (
    <div
      className="w-full h-full overflow-y-auto"
      style={{
        background: "linear-gradient(135deg, #F5E6D3 0%, #E8D4B8 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-8">
          <BookOpen
            className="w-10 h-10"
            style={{ color: "#8B4513" }}
            strokeWidth={2}
          />
          <h1
            className="text-4xl font-bold"
            style={{ color: "#8B4513", fontFamily: "serif" }}
          >
            Story Map
          </h1>
        </div>

        <div
          className="relative p-8 rounded-lg border-4 mb-8"
          style={{
            background:
              "linear-gradient(135deg, #F5E6D3 0%, #E8D4B8 50%, #F5E6D3 100%)",
            borderColor: "#8B4513",
            minHeight: "500px",
            boxShadow: "inset 0 2px 8px rgba(139, 69, 19, 0.1)",
          }}
        >
          <div className="flex flex-col gap-6">
            {storyNodes.map((node, index) => {
              const isCompleted = isStoryNodeCompleted(node.id);
              const isAvailable =
                index === 0 ||
                storyNodes
                  .slice(0, index)
                  .every((n) => isStoryNodeCompleted(n.id));

              // --- STYLING LOGIC ---
              let bgStyle = {};
              let borderStyle = {};
              let textTitleColor = "#8B4513";
              let textDescColor = "#5C4033";
              let hoverClasses = "hover:shadow-lg";

              if (!isAvailable) {
                // Locked
                bgStyle = { background: "#AAA", color: "#F5E6D3" };
                borderStyle = { borderColor: "#888" };
                textTitleColor = "#E8D4B8";
                textDescColor = "#D4CBB8";
                hoverClasses = ""; // No hover effect
              } else if (isCompleted) {
                // Completed
                bgStyle = { background: "rgba(76, 132, 119, 0.1)" };
                borderStyle = { borderColor: "#4C8477" };
                hoverClasses += " hover:border-[#2C5347]";
              } else {
                // Available
                bgStyle = { background: "rgba(212, 175, 55, 0.1)" };
                borderStyle = { borderColor: "#D4AF37" };
                hoverClasses += " hover:border-[#8B7500]";
              }
              // --- END STYLING LOGIC ---

              return (
                <button
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                  disabled={!isAvailable}
                  className={`flex items-center gap-4 w-full p-4 rounded-lg border-4 transition-all ${hoverClasses} ${
                    !isAvailable
                      ? "opacity-70 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  style={{ ...bgStyle, ...borderStyle }}
                >
                  {/* Node Icon */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center border-4 font-bold text-xl shrink-0"
                    style={{
                      background: isCompleted
                        ? "#4C8477"
                        : isAvailable
                          ? "#D4AF37"
                          : "#999",
                      borderColor: isCompleted
                        ? "#2C5347"
                        : isAvailable
                          ? "#8B7500"
                          : "#666",
                      color: "#F5E6D3",
                    }}
                  >
                    {isCompleted ? "✓" : !isAvailable ? <Lock /> : index + 1}
                  </div>
                  {/* Node Text */}
                  <div className="flex-1 text-left">
                    <h3
                      className="text-2xl font-bold mb-1"
                      style={{ color: textTitleColor }}
                    >
                      {node.title}
                    </h3>
                    <p className="text-sm" style={{ color: textDescColor }}>
                      {node.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {!nextNode && completedStoryNodes.length > 0 && (
          <div
            className="text-center p-6 rounded-lg border-2"
            style={{
              background: "rgba(212, 175, 55, 0.1)",
              borderColor: "#D4AF37",
            }}
          >
            <p className="text-sm italic" style={{ color: "#8B4513" }}>
              "The journey of a thousand li begins with a single step."
            </p>
            <p className="text-xs mt-2" style={{ color: "#5C4033" }}>
              - Ancient Proverb
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
