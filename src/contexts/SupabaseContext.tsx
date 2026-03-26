import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { secrets } from '../config/secrets';
import { getSupabaseClient } from '../../supabase';

interface SupabaseConfig {
  url: string;
  key: string;
}

interface SupabaseContextType {
  config: SupabaseConfig;
  updateConfig: (newConfig: SupabaseConfig) => void;
  isConnected: boolean;
  isTesting: boolean;
  missingTables: string[];
  client: SupabaseClient | null;
  testConnection: () => Promise<boolean>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

const DEFAULT_URL = secrets.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://mdhmbnlijiwgrdecrfeo.supabase.co';
const DEFAULT_KEY = secrets.SUPABASE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_gG_IRyVcGs6fflpt4lXseg_AQxyLIaE';

export const SupabaseProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<SupabaseConfig>(() => {
    const savedUrl = localStorage.getItem('jarvis_supabase_url');
    const savedKey = localStorage.getItem('jarvis_supabase_key');
    return {
      url: savedUrl || DEFAULT_URL,
      key: savedKey || DEFAULT_KEY,
    };
  });

  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [missingTables, setMissingTables] = useState<string[]>([]);

  useEffect(() => {
    if (config.url && config.key) {
      const newClient = getSupabaseClient(config.url, config.key);
      setClient(newClient);
      
      // Initial connection test
      const check = async () => {
        try {
          // Check for core tables
          const tables = ['app_metadata', 'sessions', 'memory', 'search_history', 'youtube_videos', 'cards', 'background_tasks', 'maps', 'photos'];
          const results = await Promise.all(
            tables.map(table => newClient.from(table).select('*').limit(1))
          );
          
          const hasError = results.some(res => res.error);
          setIsConnected(!hasError);
          
          const missing = results
            .map((res, i) => res.error ? tables[i] : null)
              .filter((t): t is string => t !== null);
          setMissingTables(missing);
          
          if (missing.length > 0) {
            console.warn('JARVIS: Supabase conectado, mas tabelas ausentes:', missing);
          }
        } catch {
          setIsConnected(false);
          setMissingTables([]);
        }
      };
      check();
    }
  }, [config]);

  const updateConfig = (newConfig: SupabaseConfig) => {
    localStorage.setItem('jarvis_supabase_url', newConfig.url);
    localStorage.setItem('jarvis_supabase_key', newConfig.key);
    setConfig(newConfig);
    
    // Also notify backend
    fetch('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    }).catch(err => console.error('Failed to sync config to backend:', err));
  };

  const testConnection = async () => {
    if (!client) return false;
    setIsTesting(true);
    try {
      const tables = ['app_metadata', 'sessions', 'memory', 'search_history', 'youtube_videos', 'cards', 'background_tasks', 'maps', 'photos'];
      const results = await Promise.all(
        tables.map(table => client.from(table).select('*').limit(1))
      );
      
      const missing = results
        .map((res, i) => res.error ? tables[i] : null)
        .filter((t): t is string => t !== null);
      
      setMissingTables(missing);
      const success = missing.length === 0;
      setIsConnected(success);
      return success;
    } catch {
      setIsConnected(false);
      setMissingTables([]);
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SupabaseContext.Provider value={{ config, updateConfig, isConnected, isTesting, missingTables, client, testConnection }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
