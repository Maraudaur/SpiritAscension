import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { BookOpen, ArrowRight, ChevronRight } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";
import storyData from "@shared/data/story.json";
import { motion, AnimatePresence } from "framer-motion";

interface StoryDialogue {
  speaker: string;
  text: string;
}

interface StoryNode {
  id: number;
  title: string;
  description: string;
  dialogues: StoryDialogue[];
  encounterId: string | null;
}

interface StoryScreenProps {
  onClose?: () => void;
  onNavigate?: (
    screen: "story" | "cultivation" | "spirits" | "summon" | "battle",
  ) => void;
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

    // Mark node as completed
    completeStoryNode(currentNodeId);

    // Check if this node triggers an encounter
    if (currentNode.encounterId !== null) {
      // Set the encounter ID in global state
      setCurrentEncounterId(currentNode.encounterId);
      
      // Trigger battle encounter
      setStoryLayer("map");
      if (onNavigate) {
        onNavigate("battle");
      }
    } else {
      // Just return to map
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
      <div
        className="absolute inset-0 z-10 flex flex-col"
        style={{
          background: "linear-gradient(180deg, #2C1810 0%, #1A0F0A 100%)",
        }}
      >
        {/* Upper 2/3: Scene and Characters */}
        <div className="flex-[2] flex items-center justify-center p-8 relative">
          {/* Background scene decoration */}
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-9xl opacity-30">🏯</div>
            </div>
          </div>

          {/* Character placeholder - could be spirit sprites in future */}
          <div className="relative z-10 flex items-center justify-center gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-8xl opacity-80"
            >
              {currentDialogue.speaker === "Narrator" ? "📜" : "🧙‍♂️"}
            </motion.div>
          </div>
        </div>

        {/* Lower 1/3: Visual Novel Dialogue Box */}
        <div className="flex-[1] flex items-end p-6">
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
                    {currentDialogue.speaker}
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
