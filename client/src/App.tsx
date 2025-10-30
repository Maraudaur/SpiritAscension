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
  const { setHitSound, setSuccessSound, setHealSound, setClickSound, setHoverSound, setExploreMusic, setBattleMusic, playExploreMusic } = useAudio();
  
  useEffect(() => {
    // Load all audio files when app initializes
    const hit = new Audio('/sounds/Hitsound.mp3');
    const success = new Audio('/sounds/success.mp3');
    const heal = new Audio('/sounds/Healsound.mp3');
    const click = new Audio('/sounds/MenuClick1.mp3');
    const hover = new Audio('/sounds/MenuHover1_1761804350112.mp3');
    const exploreMusic = new Audio('/sounds/ExploreBase.mp3');
    const battleMusic = new Audio('/sounds/Battle3.mp3');
    
    // Load all audio files
    hit.load();
    success.load();
    heal.load();
    click.load();
    hover.load();
    exploreMusic.load();
    battleMusic.load();
    
    console.log('✨ All audio files loaded:', { 
      hit: hit.src, 
      success: success.src,
      heal: heal.src,
      click: click.src,
      hover: hover.src,
      exploreMusic: exploreMusic.src,
      battleMusic: battleMusic.src
    });
    
    setHitSound(hit);
    setSuccessSound(success);
    setHealSound(heal);
    setClickSound(click);
    setHoverSound(hover);
    setExploreMusic(exploreMusic);
    setBattleMusic(battleMusic);
    
    // Initialize audio on first user interaction
    const initializeAudio = async () => {
      if (!audioInitialized) {
        try {
          // Play and immediately pause to unlock audio for all sounds
          const sounds = [hit, success, heal, click, hover, exploreMusic, battleMusic];
          for (const sound of sounds) {
            await sound.play();
            sound.pause();
            sound.currentTime = 0;
          }
          
          console.log('🎵 Audio context unlocked for all sounds!');
          setAudioInitialized(true);
          
          // Start playing explore music
          playExploreMusic();
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
  }, [setHitSound, setSuccessSound, setHealSound, setClickSound, setHoverSound, setExploreMusic, setBattleMusic, playExploreMusic, audioInitialized]);

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
