import { useEffect } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { Sparkles } from "lucide-react";

export function QiHUD() {
  const { qi, qiPerSecond, updateQi } = useGameState();

  useEffect(() => {
    const interval = setInterval(() => {
      updateQi();
    }, 100);

    return () => clearInterval(interval);
  }, [updateQi]);

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(2)}B`;
    } else if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(2)}K`;
    }
    return Math.floor(num).toLocaleString();
  };

  return (
    <div
      className="flex items-center justify-center gap-8 px-6 py-3"
      style={{
        background: "linear-gradient(135deg, #D4B896 0%, #C1A877 50%, #D4B896 100%)",
        borderBottom: "3px solid #8B4513",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-full"
          style={{
            background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
            boxShadow: "0 2px 6px rgba(255, 215, 0, 0.4)",
          }}
        >
          <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        
        <div className="flex flex-col">
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: "#5D4037" }}
          >
            QI ENERGY
          </span>
          <span
            className="text-2xl font-bold tracking-tight"
            style={{
              color: "#C1272D",
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
            }}
          >
            {formatNumber(qi)}
          </span>
        </div>
      </div>

      <div
        className="h-10 w-px"
        style={{ background: "linear-gradient(to bottom, transparent, #8B4513, transparent)" }}
      />

      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end">
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: "#5D4037" }}
          >
            GENERATION
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-lg font-bold"
              style={{
                color: "#2E7D32",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              }}
            >
              +{formatNumber(qiPerSecond)}
            </span>
            <span className="text-xs font-medium" style={{ color: "#5D4037" }}>
              /sec
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
