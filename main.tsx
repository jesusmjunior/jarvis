// ==============================================================
// JARVIS 360° — src/main.tsx
// Entry point com JarvisProvider
// ==============================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JarvisProvider } from './src/contexts/JarvisProvider';
import App from './src/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JarvisProvider>
      <App />
    </JarvisProvider>
  </StrictMode>
);
