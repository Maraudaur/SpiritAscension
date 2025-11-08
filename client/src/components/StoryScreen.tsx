import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { BookOpen, ArrowRight, ChevronRight } from "lucide-react";
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
  // (You'd need to handle image preloading or 404s in a real app)
  return `/images/portraits/${characterId.toLowerCase()}/${expression}.png`;
}

export function StoryScreen({ onClose, onNavigate }: StoryScreenProps) {
  const [storyLayer, setStoryLayer] = useState<"map" | "scene">("map");
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0);

  const {
    completedStoryNodes,
    completeStoryNode,
    isStoryNodeCompleted,
    setCurrentEncounterId,
  } = useGameState();

  const storyNodes = storyData as StoryNode[];
  const currentNode = storyNodes.find((n) => n.id === currentNodeId);

  const handleNodeClick = (nodeId: number) => {
    setCurrentNodeId(nodeId);
    setCurrentDialogueIndex(0);
    setStoryLayer("scene");
  };

  const handleContinueDialogue = () => {
    if (!currentNode) return;

    if (currentDialogueIndex < currentNode.dialogues.length - 1) {
      setCurrentDialogueIndex(currentDialogueIndex + 1);
    } else {
      // Reached the end of dialogues
      handleNodeComplete();
    }
  };

  const handleNodeComplete = () => {
    if (currentNodeId === null || !currentNode) return;

    // Check if this is the first time completing this node
    const isFirstCompletion = !isStoryNodeCompleted(currentNodeId);

    // Mark node as completed
    completeStoryNode(currentNodeId);

    // Only trigger encounter on first completion
    if (isFirstCompletion && currentNode.encounterId !== null) {
      // Set the encounter ID in global state
      setCurrentEncounterId(currentNode.encounterId);

      // Trigger battle encounter
      setStoryLayer("map");
      if (onNavigate) {
        onNavigate("battle");
      }
    } else {
      // Just return to map (replay or no encounter)
      setStoryLayer("map");
    }
  };

  const handleSkipToMap = () => {
    setStoryLayer("map");
  };

  const getNextIncompleteNode = () => {
    return storyNodes.find((node) => !isStoryNodeCompleted(node.id));
  };

  const nextNode = getNextIncompleteNode();

  if (storyLayer === "scene" && currentNode) {
    const currentDialogue = currentNode.dialogues[currentDialogueIndex];
    const isLastDialogue =
      currentDialogueIndex === currentNode.dialogues.length - 1;

    return (
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* 1. Background Image (MOVED HERE) */}
        {(() => {
          const currentDialogue = currentNode.dialogues[currentDialogueIndex];
          const backgroundToShow =
            currentDialogue.background ?? currentNode.background;

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
          {/* 2. Character Sprites */}
          <div className="relative z-10 w-full h-full flex items-end justify-center">
            {currentNode.characters.map((character) => {
              const currentDialogue =
                currentNode.dialogues[currentDialogueIndex];

              // Find out if the current speaker *has* a character sprite
              const speakerHasSprite = currentNode.characters.some(
                (c) => c.id === currentDialogue.speakerId,
              );

              // Is this specific character the one speaking?
              const isSpeaking =
                currentDialogue.speakerId.toLowerCase() ===
                character.id.toLowerCase();

              // Determine the correct expression
              const expression = isSpeaking
                ? currentDialogue.expression
                : "neutral"; // Default to neutral when not speaking

              // Get the image path
              const imagePath = getPortraitPath(character.id, expression);

              // Determine opacity
              let targetOpacity = 0; // Start hidden
              if (speakerHasSprite) {
                targetOpacity = isSpeaking ? 1 : 0.6; // Highlight speaker, dim others
              }

              return (
                <motion.div
                  key={character.id}
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    // Use custom properties for CSS-based positioning
                    // @ts-ignore
                    "--position-x":
                      character.position === "left"
                        ? "-25%"
                        : character.position === "right"
                          ? "80%"
                          : "0%",
                  }}
                  animate={{
                    opacity: targetOpacity, // <-- NEW LOGIC
                    scale: isSpeaking ? 1.05 : 1,
                    y: isSpeaking ? -10 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <img
                    src={imagePath}
                    alt={character.id}
                    className="max-h-[70vh] object-contain"
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
              key={currentDialogueIndex}
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
                            index <= currentDialogueIndex ? "#4C8477" : "#999",
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
                        borderColor: "#8B4513",
                        color: "#8B4513",
                      }}
                    >
                      Skip to Map
                    </Button>
                    <Button
                      onClick={handleContinueDialogue}
                      className="px-6 py-2 flex items-center gap-2"
                      style={{
                        background: "#4C8477",
                        color: "#F5E6D3",
                      }}
                    >
                      {isLastDialogue ? (
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

              return (
                <div key={node.id} className="flex items-center gap-4">
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
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  <div className="flex-1">
                    <h3
                      className="text-2xl font-bold mb-1"
                      style={{ color: "#8B4513" }}
                    >
                      {node.title}
                    </h3>
                    <p className="text-sm" style={{ color: "#5C4033" }}>
                      {node.description}
                    </p>
                  </div>
                  {isAvailable && (
                    <Button
                      onClick={() => handleNodeClick(node.id)}
                      className="px-6 py-3"
                      style={{
                        background: isCompleted ? "#3A6EA5" : "#4C8477",
                        color: "#F5E6D3",
                      }}
                    >
                      {isCompleted ? "Replay" : "Continue Story"}
                    </Button>
                  )}
                  {!isAvailable && (
                    <div
                      className="px-6 py-3 rounded opacity-50"
                      style={{
                        background: "#999",
                        color: "#F5E6D3",
                      }}
                    >
                      Locked
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {nextNode && (
          <div
            className="text-center p-6 rounded-lg border-2 cursor-pointer hover:border-4 transition-all"
            style={{
              background: "rgba(76, 132, 119, 0.1)",
              borderColor: "#4C8477",
            }}
            onClick={() => handleNodeClick(nextNode.id)}
          >
            <p className="text-lg font-bold mb-2" style={{ color: "#4C8477" }}>
              Next: {nextNode.title}
            </p>
            <p className="text-sm" style={{ color: "#5C4033" }}>
              Click to continue your journey
            </p>
          </div>
        )}

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
