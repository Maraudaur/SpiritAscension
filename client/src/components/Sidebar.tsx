import { BookOpen, Zap, Users, Sparkles, Swords } from "lucide-react";
import { useGameState } from "../lib/stores/useGameState";

type Screen = "story" | "cultivation" | "spirits" | "summon" | "battle";

// --- FIX: This is the only interface needed ---
interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

// --- FIX: This is the only Sidebar function, now with FTUE logic ---
export function Sidebar({ currentScreen, onNavigate }: SidebarProps) {
  // --- Logic merged from your first function ---
  const ftueStep = useGameState((s) => s.ftueStep);
  const setFtueStep = useGameState((s) => s.setFtueStep);

  const handleNavigate = (screen: Screen) => {
    // 1. Always navigate
    onNavigate(screen);

    // 2. Check and advance FTUE step
    if (screen === "cultivation" && ftueStep === "highlightCultivation") {
      setFtueStep("highlightUpgradeBase");
    }
    if (screen === "summon" && ftueStep === "highlightSummon") {
      setFtueStep("highlightSummonButton");
    }
    if (screen === "spirits" && ftueStep === "highlightSpirits") {
      setFtueStep("highlightFirstSpirit");
    }
    if (screen === "spirits" && ftueStep === "highlightSpiritsForNode1") {
      setFtueStep("highlightFirstSpirit");
    }
    if (screen === "battle" && ftueStep === "highlightBattle") {
      // Don't clear yet - will clear after winning battle
      // Keep highlightBattle active so player knows this is FTUE
    }
  };
  // --- End of merged logic ---

  const navItems = [
    { id: "story" as Screen, icon: BookOpen, label: "Story", color: "#D4AF37" },
    {
      id: "cultivation" as Screen,
      icon: Zap,
      label: "Cultivation",
      color: "#4C8477",
    },
    {
      id: "spirits" as Screen,
      icon: Users,
      label: "Spirits",
      color: "#3A6EA5",
    },
    {
      id: "summon" as Screen,
      icon: Sparkles,
      label: "Summon",
      color: "#9B4DCA",
    },
    { id: "battle" as Screen, icon: Swords, label: "Battle", color: "#C1272D" },
  ];

  return (
    <div
      className="fixed left-0 top-0 h-screen flex flex-col items-center py-8 gap-6 border-r-4"
      style={{
        width: "100px",
        background: "linear-gradient(180deg, #F5E6D3 0%, #E8D4B8 100%)",
        borderColor: "#8B4513",
        boxShadow: "4px 0 12px rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* Logo/Title Area */}
      <div className="text-center px-2">
        <h1
          className="text-2xl font-bold"
          style={{
            color: "#8B4513",
            fontFamily: "serif",
            textShadow: "2px 2px 4px rgba(139, 69, 19, 0.3)",
          }}
        >
          昇
        </h1>
        <p className="text-xs" style={{ color: "#8B4513" }}>
          Ascension
        </p>
      </div>

      {/* Divider */}
      <div className="w-16 h-1 rounded" style={{ background: "#8B4513" }} />

      {/* Navigation Buttons */}
      <nav className="flex flex-col gap-4 w-full px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;

          // --- FIX: Apply FTUE class logic here ---
          let ftueClass = "";
          if (
            item.id === "cultivation" &&
            ftueStep === "highlightCultivation"
          ) {
            ftueClass = "animate-pulse-bright";
          }
          if (item.id === "summon" && ftueStep === "highlightSummon") {
            ftueClass = "animate-pulse-bright";
          }
          if (item.id === "spirits" && ftueStep === "highlightSpirits") {
            ftueClass = "animate-pulse-bright";
          }
          if (item.id === "spirits" && ftueStep === "highlightSpiritsForNode1") {
            ftueClass = "animate-pulse-bright";
          }
          if (item.id === "battle" && ftueStep === "highlightBattle") {
            ftueClass = "animate-pulse-bright";
          }
          if (item.id === "cultivation" && ftueStep === "highlightMultiplier") {
            ftueClass = "animate-pulse-bright";
          }

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)} // <-- Use merged handler
              className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 ${ftueClass}`} // <-- Apply FTUE class
              style={{
                background: isActive ? item.color : "rgba(245, 230, 211, 0.5)",
                color: isActive ? "#F5E6D3" : "#8B4513",
                border: isActive
                  ? `2px solid ${item.color}`
                  : "2px solid transparent",
                boxShadow: isActive
                  ? `0 4px 8px ${item.color}40`
                  : "0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
            >
              <Icon className="w-6 h-6" strokeWidth={2.5} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer/Version */}
      <div className="text-center px-2">
        <p className="text-[10px]" style={{ color: "#8B4513" }}>
          v1.0
        </p>
      </div>
    </div>
  );
}
