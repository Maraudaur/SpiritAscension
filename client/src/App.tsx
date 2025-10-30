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
  const [audioInitialized, setAudioInitialized] = useState(false);
  const { setHitSound, setSuccessSound } = useAudio();
  
  useEffect(() => {
    // Load audio files when app initializes
    const hit = new Audio('/sounds/hit.mp3');
    const success = new Audio('/sounds/success.mp3');
    
    hit.load();
    success.load();
    
    console.log('Audio files loaded:', { hit: hit.src, success: success.src });
    
    setHitSound(hit);
    setSuccessSound(success);
    
    // Initialize audio on first user interaction
    const initializeAudio = async () => {
      if (!audioInitialized) {
        try {
          // Play and immediately pause to unlock audio
          await hit.play();
          hit.pause();
          hit.currentTime = 0;
          
          await success.play();
          success.pause();
          success.currentTime = 0;
          
          console.log('Audio context unlocked');
          setAudioInitialized(true);
        } catch (err) {
          console.log('Audio unlock failed, will retry on next interaction:', err);
        }
      }
    };
    
    // Try to initialize on any user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, initializeAudio, { once: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, initializeAudio);
      });
    };
  }, [setHitSound, setSuccessSound, audioInitialized]);

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
