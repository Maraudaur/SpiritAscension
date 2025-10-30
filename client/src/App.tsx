import { useState, useEffect } from "react";
import { MainScreen } from "./components/MainScreen";
import { SummonScreen } from "./components/SummonScreen";
import { SpiritManager } from "./components/SpiritManager";
import { BattleScreen } from "./components/BattleScreen";
import { useAudio } from "./lib/stores/useAudio";
import "@fontsource/inter";

type Screen = 'main' | 'spirits' | 'battle' | 'summon';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const { setHitSound, setSuccessSound } = useAudio();
  
  useEffect(() => {
    // Load audio files when app initializes
    const hit = new Audio('/sounds/hit.mp3');
    const success = new Audio('/sounds/success.mp3');
    
    setHitSound(hit);
    setSuccessSound(success);
  }, [setHitSound, setSuccessSound]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <MainScreen onNavigate={setCurrentScreen} />

      {currentScreen === 'summon' && (
        <SummonScreen onClose={() => setCurrentScreen('main')} />
      )}

      {currentScreen === 'spirits' && (
        <SpiritManager onClose={() => setCurrentScreen('main')} />
      )}

      {currentScreen === 'battle' && (
        <BattleScreen onClose={() => setCurrentScreen('main')} />
      )}
    </div>
  );
}

export default App;
