import { createContext, useContext } from 'react';
import { VOICES } from '../data/voice';

// The active theme's words. App provides it from the theme setting; anything
// rendered outside the provider (tests, a stray portal) falls back to the
// medieval voice rather than to nothing.
export const VoiceContext = createContext(VOICES.medieval);

export function useVoice() {
  return useContext(VoiceContext);
}
