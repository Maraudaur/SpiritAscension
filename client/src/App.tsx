import { useState, useEffect, useRef } from "react"; // Import useRef
import { MainScreen } from "./components/MainScreen";
import { SummonScreen } from "./components/SummonScreen";
import { SpiritManager } from "./components/SpiritManager";
import { BattleScreen } from "./components/BattleScreen";
import { useAudio } from "./lib/stores/useAudio";
import "@fontsource/inter";

type Screen = "main" | "spirits" | "battle" | "summon" | "boss";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("main");

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
        position: "relative",
        overflow: "auto",
      }}
    >
      <MainScreen onNavigate={setCurrentScreen} />

      {currentScreen === "summon" && (
        <SummonScreen onClose={() => setCurrentScreen("main")} />
      )}

      {currentScreen === "spirits" && (
        <SpiritManager onClose={() => setCurrentScreen("main")} />
      )}

      {currentScreen === "battle" && (
        <BattleScreen onClose={() => setCurrentScreen("main")} />
      )}

      {currentScreen === "boss" && (
        <BattleScreen
          onClose={() => setCurrentScreen("main")}
          isBossBattle={true}
        />
      )}
    </div>
  );
}

export default App;
