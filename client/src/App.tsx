import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { QiHUD } from "./components/QiHUD";
import { StoryScreen } from "./components/StoryScreen";
import { MainScreen } from "./components/MainScreen";
import { SummonScreen } from "./components/SummonScreen";
import { SpiritManager } from "./components/SpiritManager";
import { BattleScreen } from "./components/BattleScreen";
import { useAudio } from "./lib/stores/useAudio";
import "@fontsource/inter";

type Screen = "story" | "cultivation" | "spirits" | "summon" | "battle";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("story");
  const [isBossBattle, setIsBossBattle] = useState(false);

  // Get all functions from the store
  const {
    setHitSound,
    setSuccessSound,
    setHealSound,
    setClickSound,
    setHoverSound,
    setExploreMusic,
    setBattleMusic,
    playExploreMusic,
  } = useAudio();

  // Use a ref to ensure initialization runs only once
  const audioInitialized = useRef(false);

  useEffect(() => {
    // Check if audio is already initialized
    if (audioInitialized.current) {
      return;
    }

    // Mark as initialized immediately
    audioInitialized.current = true;

    console.log("✨ Initializing audio... (This should only run once)");

    // --- Create Audio Elements ONCE ---
    const hit = new Audio("/sounds/Hitsound.mp3");
    const success = new Audio("/sounds/success.mp3");
    const heal = new Audio("/sounds/Healsound.mp3");
    const click = new Audio("/sounds/MenuClick1.mp3");
    const hover = new Audio("/sounds/MenuHover1_1761804350112.mp3");

    const exploreMusic = new Audio("/sounds/ExploreBase.mp3");
    exploreMusic.loop = true; // Set looping

    const battleMusic = new Audio("/sounds/Battle3.mp3");
    battleMusic.loop = true; // Set looping

    // --- Set them in the store ---
    setHitSound(hit);
    setSuccessSound(success);
    setHealSound(heal);
    setClickSound(click);
    setHoverSound(hover);
    setExploreMusic(exploreMusic);
    setBattleMusic(battleMusic);

    // --- Add one listener for first user interaction ---
    const startMusicOnInteraction = () => {
      console.log("🎵 User interacted, attempting to play music.");
      playExploreMusic();

      // Remove this listener after it runs once
      document.removeEventListener("click", startMusicOnInteraction);
      document.removeEventListener("keydown", startMusicOnInteraction);
    };

    // { once: true } automatically removes the listener after it fires
    document.addEventListener("click", startMusicOnInteraction, { once: true });
    document.addEventListener("keydown", startMusicOnInteraction, {
      once: true,
    });

    // Cleanup listeners on component unmount (though App rarely unmounts)
    return () => {
      document.removeEventListener("click", startMusicOnInteraction);
      document.removeEventListener("keydown", startMusicOnInteraction);
    };

    // The store setter functions are stable, so this array is safe
    // and the effect will only run once as intended.
  }, [
    setHitSound,
    setSuccessSound,
    setHealSound,
    setClickSound,
    setHoverSound,
    setExploreMusic,
    setBattleMusic,
    playExploreMusic,
  ]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: "linear-gradient(135deg, #1A0F0A 0%, #2C1810 100%)",
      }}
    >
      <Sidebar currentScreen={currentScreen} onNavigate={setCurrentScreen} />

      <div
        style={{
          marginLeft: "100px",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "1920px",
            aspectRatio: "16/9",
            maxHeight: "100%",
            background: "#F5E6D3",
            borderRadius: "8px",
            border: "4px solid #8B4513",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <QiHUD currentScreen={currentScreen} />
          
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {currentScreen === "story" && <StoryScreen />}
            
            {currentScreen === "cultivation" && !isBossBattle && (
              <div className="w-full h-full overflow-y-auto">
                <MainScreen 
                  onNavigate={setCurrentScreen}
                  onBossBattle={() => {
                    setIsBossBattle(true);
                    setCurrentScreen("battle");
                  }}
                />
              </div>
            )}

            {currentScreen === "spirits" && (
              <div className="w-full h-full overflow-hidden">
                <SpiritManager onClose={() => setCurrentScreen("cultivation")} />
              </div>
            )}

            {currentScreen === "summon" && (
              <div className="w-full h-full overflow-hidden">
                <SummonScreen onNavigate={setCurrentScreen} />
              </div>
            )}

            {currentScreen === "battle" && (
              <div className="w-full h-full overflow-hidden">
                <BattleScreen 
                  onClose={() => {
                    setCurrentScreen("cultivation");
                    setIsBossBattle(false);
                  }} 
                  isBossBattle={isBossBattle}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
