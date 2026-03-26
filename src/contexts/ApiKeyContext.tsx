import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { errorService, ErrorCategory } from '../services/errorService';
import { GoogleGenAI } from "@google/genai";

interface ApiKeyRecord {
  id: string;
  name: string;
  maskedKey: string;
  key?: string; // Real key (obfuscated in storage)
  expiresAt: string;
  engine: string;
  savedAt: string;
  status: "idle" | "testing" | "success" | "error" | "quota_exceeded";
}

interface ApiKeyContextType {
  activeKey: string | null;
  activeKeyId: string | null;
  keys: ApiKeyRecord[];
  setActiveKeyId: (id: string | null) => void;
  setKeys: (keys: ApiKeyRecord[]) => void;
  isLoading: boolean;
  testKey: (key: string) => Promise<{ success: boolean; status: "success" | "error" | "quota_exceeded" }>;
  refreshStatus: () => Promise<void>;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

// Helper to obfuscate/deobfuscate
const obfuscate = (str: string) => btoa(str);
const deobfuscate = (str: string) => atob(str);

export const ApiKeyProvider = ({ children }: { children: ReactNode }) => {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeKey = React.useMemo(() => {
    if (!activeKeyId) return null;
    const keyRecord = keys.find(k => k.id === activeKeyId);
    return keyRecord && keyRecord.key ? deobfuscate(keyRecord.key) : null;
  }, [keys, activeKeyId]);

  useEffect(() => {
    if (activeKey) {
      sessionStorage.setItem("jarvis_api_key", activeKey);
      window.dispatchEvent(new Event("jarvis_key_updated"));
    }
  }, [activeKey]);

  useEffect(() => {
    const loadKeys = () => {
      try {
        const storedKeys = localStorage.getItem('jarvis_keys_v2');
        const storedActiveId = localStorage.getItem('jarvis_active_key_id');
        
        if (storedKeys) {
          const parsedKeys = JSON.parse(storedKeys) as ApiKeyRecord[];
          setKeys(parsedKeys);
          if (storedActiveId) {
            setActiveKeyId(storedActiveId);
          }
        }
      } catch (err) {
        errorService.log(err, ErrorCategory.DATABASE, 'Erro ao carregar chaves da API.');
      } finally {
        setIsLoading(false);
      }
    };
    loadKeys();
  }, []);

  const handleSetActiveKeyId = (id: string | null) => {
    setActiveKeyId(id);
    if (id) {
      localStorage.setItem('jarvis_active_key_id', id);
    } else {
      localStorage.removeItem('jarvis_active_key_id');
    }
  };

  const handleSetKeys = (newKeys: ApiKeyRecord[]) => {
    setKeys(newKeys);
    localStorage.setItem('jarvis_keys_v2', JSON.stringify(newKeys));
  };

  const testKey = async (key: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "test",
      });
      return { success: !!response.text, status: "success" as const };
    } catch (err: any) {
      console.error("Erro ao testar chave:", err);
      const errorMsg = err.message || "";
      if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        return { success: false, status: "quota_exceeded" as const };
      }
      return { success: false, status: "error" as const };
    }
  };

  const refreshStatus = async () => {
    const updatedKeys = await Promise.all(keys.map(async (k) => {
      if (!k.key) return k;
      const result = await testKey(deobfuscate(k.key));
      return { ...k, status: result.status } as ApiKeyRecord;
    }));
    handleSetKeys(updatedKeys);
  };

  return (
    <ApiKeyContext.Provider value={{ 
      activeKey, 
      activeKeyId, 
      keys, 
      setActiveKeyId: handleSetActiveKeyId, 
      setKeys: handleSetKeys, 
      isLoading,
      testKey,
      refreshStatus
    }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};
