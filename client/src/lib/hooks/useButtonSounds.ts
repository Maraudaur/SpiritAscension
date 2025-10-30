import { useAudio } from '@/lib/stores/useAudio';

export function useButtonSounds() {
  const { playButtonClick, playButtonHover } = useAudio();
  
  return {
    onClick: playButtonClick,
    onMouseEnter: playButtonHover,
  };
}
