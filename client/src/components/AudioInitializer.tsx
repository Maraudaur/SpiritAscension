import { useEffect, useRef } from "react";
import { useAudio } from "@/lib/stores/useAudio";

export function AudioInitializer() {
  const {
    setExploreMusic,
    setBattleMusic,
    setHitSound,
    setHealSound,
    setClickSound,
    setHoverSound,
    playExploreMusic,
  } = useAudio();

  // Use a ref to ensure this runs only once
  const audioInitialized = useRef(false);

  useEffect(() => {
    // Check if audio is already initialized
    if (audioInitialized.current) {
      return;
    }

    // --- Create Audio Elements ONCE ---
    const exploreAudio = new Audio("/sounds/explorebase.mp3");
    exploreAudio.loop = true;
    exploreAudio.volume = 0.3;

    const battleAudio = new Audio("/sounds/battle3.mp3");
    battleAudio.loop = true;
    battleAudio.volume = 0.4;

    const hitAudio = new Audio("/sounds/hit.mp3");
    const healAudio = new Audio("/sounds/heal.mp3");
    const clickAudio = new Audio("/sounds/button-click.mp3");
    const hoverAudio = new Audio("/sounds/button-hover.mp3");

    // --- Set them in the store ---
    setExploreMusic(exploreAudio);
    setBattleMusic(battleAudio);
    setHitSound(hitAudio);
    setHealSound(healAudio);
    setClickSound(clickAudio);
    setHoverSound(hoverAudio);

    // Mark as initialized
    audioInitialized.current = true;

    // Optional: Auto-play explore music on load
    // We add a listener for the first user interaction
    const startMusic = () => {
      console.log("User interacted, attempting to play music.");
      playExploreMusic();
      // Remove this listener after it runs once
      document.removeEventListener("click", startMusic);
      document.removeEventListener("keydown", startMusic);
    };

    document.addEventListener("click", startMusic);
    document.addEventListener("keydown", startMusic);

    // Cleanup listeners
    return () => {
      document.removeEventListener("click", startMusic);
      document.removeEventListener("keydown", startMusic);
    };
  }, []); // Empty array ensures this runs only on mount

  // This component renders nothing
  return null;
}
