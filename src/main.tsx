import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ApiKeyProvider } from './contexts/ApiKeyContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ApiKeyProvider>
        <SupabaseProvider>
          <App />
        </SupabaseProvider>
      </ApiKeyProvider>
    </ErrorBoundary>
  </StrictMode>,
);
