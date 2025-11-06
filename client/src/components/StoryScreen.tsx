import { useState } from "react";
import { Button } from "./ui/button";
import { BookOpen, ArrowRight } from "lucide-react";

interface StoryScreenProps {
  onClose?: () => void;
}

export function StoryScreen({ onClose }: StoryScreenProps) {
  const [storyLayer, setStoryLayer] = useState<"map" | "scene">("map");
  const [currentNode, setCurrentNode] = useState(0);

  const storyNodes = [
    {
      id: 0,
      title: "The Awakening",
      description: "You open your eyes to find yourself in a mystical realm...",
      completed: true,
    },
    {
      id: 1,
      title: "First Cultivation",
      description: "Learn the basics of Qi cultivation",
      completed: false,
    },
    {
      id: 2,
      title: "Spirit Bonding",
      description: "Form your first bond with a spirit companion",
      completed: false,
    },
    {
      id: 3,
      title: "The Trial",
      description: "Face your first challenge",
      completed: false,
    },
  ];

  if (storyLayer === "scene") {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg, #2C1810 0%, #1A0F0A 100%)",
        }}
      >
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <div
              className="max-w-4xl w-full p-12 rounded-lg border-4"
              style={{
                background: "rgba(245, 230, 211, 0.95)",
                borderColor: "#8B4513",
              }}
            >
              <h2
                className="text-4xl font-bold mb-6 text-center"
                style={{ color: "#8B4513", fontFamily: "serif" }}
              >
                {storyNodes[currentNode].title}
              </h2>
              <p
                className="text-lg leading-relaxed mb-8"
                style={{ color: "#5C4033" }}
              >
                {storyNodes[currentNode].description}
              </p>
              <p className="text-base mb-8" style={{ color: "#5C4033" }}>
                In the ancient lands of cultivation, where immortals walked among
                clouds and spirits danced with the wind, you begin your journey.
                The path to ascension is long and fraught with trials, but those
                who persevere shall touch the heavens themselves.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => setStoryLayer("map")}
                  className="px-8 py-4"
                  style={{
                    background: "#3A6EA5",
                    color: "#F5E6D3",
                  }}
                >
                  Return to Map
                </Button>
                <Button
                  onClick={() => {
                    if (currentNode < storyNodes.length - 1) {
                      setCurrentNode(currentNode + 1);
                    } else {
                      setStoryLayer("map");
                    }
                  }}
                  className="px-8 py-4"
                  style={{
                    background: "#4C8477",
                    color: "#F5E6D3",
                  }}
                >
                  Continue <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
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
            background: "linear-gradient(135deg, #F5E6D3 0%, #E8D4B8 50%, #F5E6D3 100%)",
            borderColor: "#8B4513",
            minHeight: "500px",
            boxShadow: "inset 0 2px 8px rgba(139, 69, 19, 0.1)",
          }}
        >
          <div className="flex flex-col gap-6">
            {storyNodes.map((node, index) => (
              <div
                key={node.id}
                className="flex items-center gap-4"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-4 font-bold text-xl"
                  style={{
                    background: node.completed ? "#4C8477" : "#999",
                    borderColor: node.completed ? "#2C5347" : "#666",
                    color: "#F5E6D3",
                  }}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h3
                    className="text-2xl font-bold mb-1"
                    style={{ color: "#8B4513" }}
                  >
                    {node.title}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "#5C4033" }}
                  >
                    {node.description}
                  </p>
                </div>
                {index === 0 && (
                  <Button
                    onClick={() => setStoryLayer("scene")}
                    className="px-6 py-3"
                    style={{
                      background: "#4C8477",
                      color: "#F5E6D3",
                    }}
                  >
                    Continue Story
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div
          className="text-center p-6 rounded-lg border-2"
          style={{
            background: "rgba(212, 175, 55, 0.1)",
            borderColor: "#D4AF37",
          }}
        >
          <p
            className="text-sm italic"
            style={{ color: "#8B4513" }}
          >
            "The journey of a thousand li begins with a single step."
          </p>
          <p
            className="text-xs mt-2"
            style={{ color: "#5C4033" }}
          >
            - Ancient Proverb
          </p>
        </div>
      </div>
    </div>
  );
}
