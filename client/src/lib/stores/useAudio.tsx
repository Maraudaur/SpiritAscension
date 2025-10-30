import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  healSound: HTMLAudioElement | null;
  clickSound: HTMLAudioElement | null;
  hoverSound: HTMLAudioElement | null;
  isMuted: boolean;
  
  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;
  setHealSound: (sound: HTMLAudioElement) => void;
  setClickSound: (sound: HTMLAudioElement) => void;
  setHoverSound: (sound: HTMLAudioElement) => void;
  
  // Control functions
  toggleMute: () => void;
  playHit: () => void;
  playSuccess: () => void;
  playButtonClick: () => void;
  playButtonHover: () => void;
  playDamage: () => void;
  playHeal: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  healSound: null,
  clickSound: null,
  hoverSound: null,
  isMuted: false, // Start unmuted so sounds play by default
  
  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  setHealSound: (sound) => set({ healSound: sound }),
  setClickSound: (sound) => set({ clickSound: sound }),
  setHoverSound: (sound) => set({ hoverSound: sound }),
  
  toggleMute: () => {
    const { isMuted } = get();
    const newMutedState = !isMuted;
    
    // Just update the muted state
    set({ isMuted: newMutedState });
    
    // Log the change
    console.log(`Sound ${newMutedState ? 'muted' : 'unmuted'}`);
  },
  
  playHit: () => {
    const { hitSound, isMuted } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }
      
      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },
  
  playSuccess: () => {
    const { successSound, isMuted } = get();
    if (successSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }
      
      successSound.currentTime = 0;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  },
  
  playButtonClick: () => {
    const { clickSound, isMuted } = get();
    console.log('🔊 playButtonClick called:', { 
      hasSound: !!clickSound, 
      isMuted,
      soundSrc: clickSound?.src,
      readyState: clickSound?.readyState,
      duration: clickSound?.duration,
      volume: clickSound?.volume
    });
    if (clickSound && !isMuted) {
      const soundClone = clickSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.4;
      soundClone.play()
        .then(() => {
          console.log('✅ Click sound played!', {
            duration: soundClone.duration
          });
        })
        .catch((err) => console.log('❌ Button click sound play error:', err));
    } else {
      console.log('⏸️ Click sound NOT played (muted or no sound loaded)');
    }
  },
  
  playButtonHover: () => {
    const { hoverSound, isMuted } = get();
    console.log('🔊 playButtonHover called:', { 
      hasSound: !!hoverSound, 
      isMuted,
      soundSrc: hoverSound?.src,
      readyState: hoverSound?.readyState,
      duration: hoverSound?.duration
    });
    if (hoverSound && !isMuted) {
      const soundClone = hoverSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.2;
      soundClone.play()
        .then(() => {
          console.log('✅ Hover sound played!', {
            duration: soundClone.duration
          });
        })
        .catch((err) => console.log('❌ Button hover sound play error:', err));
    } else {
      console.log('⏸️ Hover sound NOT played (muted or no sound loaded)');
    }
  },
  
  playDamage: () => {
    const { hitSound, isMuted } = get();
    if (hitSound && !isMuted) {
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.4;
      soundClone.playbackRate = 0.9;
      soundClone.play().catch(() => {});
    }
  },
  
  playHeal: () => {
    const { healSound, isMuted } = get();
    if (healSound && !isMuted) {
      const soundClone = healSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = 0.3;
      soundClone.currentTime = 0;
      soundClone.play().catch(() => {});
    }
  }
}));
