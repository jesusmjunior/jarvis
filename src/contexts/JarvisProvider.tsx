// ==============================================================
// JARVIS 360° — src/context/JarvisProvider.tsx
// Context global — envolve o App inteiro
// Uso: <JarvisProvider><App /></JarvisProvider>
// ==============================================================

import { createContext, useContext, type ReactNode } from 'react';
import { useJarvis, type JarvisHook } from '../hooks/useJarvis';

const JarvisContext = createContext<JarvisHook | null>(null);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const jarvis = useJarvis();
  return (
    <JarvisContext.Provider value={jarvis}>
      {children}
    </JarvisContext.Provider>
  );
}

export function useJarvisContext(): JarvisHook {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error('useJarvisContext deve estar dentro de JarvisProvider');
  return ctx;
}
