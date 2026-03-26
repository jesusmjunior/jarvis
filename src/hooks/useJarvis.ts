// ==============================================================
// JARVIS 360° — src/hooks/useJarvis.ts
// Hook unificado: Auth + Supabase
// Admins: admjesusia@gmail.com, jesusmjunior2021@gmail.com, martjesusmartins@gmail.com
// Uso: const jarvis = useJarvis()
// ==============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { memoryService }      from '../services/memoryService';

// ─── Types ────────────────────────────────────────────────────
export type MemoryLayer = 'L1' | 'L2' | 'L3' | 'L4';

export interface Message {
  id:        string;
  role:      'user' | 'assistant' | 'system';
  content:   string;
  timestamp: number;
}

export interface JarvisState {
  // Auth
  session:       any | null;
  isAuth:        boolean;
  isAdmin:       boolean;
  isLoading:     boolean;
  error:         string | null;
  // Chat
  sessionId:     string | null;
  messages:      Message[];
  isSyncing:     boolean;
  // Metadata
  storageMode:   'memory' | 'local' | 'drive';
}

// ─── Hook principal ───────────────────────────────────────────
export function useJarvis() {
  const [state, setState] = useState<JarvisState>({
    session:     null,
    isAuth:      false,
    isAdmin:     false,
    isLoading:   false,
    error:       null,
    sessionId:   null,
    messages:    [],
    isSyncing:   false,
    storageMode: 'memory',
  });

  const saveGuardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const L1Cache        = useRef<Message[]>([]);

  // ─── Inicialização ─────────────────────────────────────────
  useEffect(() => {
    setState(s => ({ ...s, isLoading: false }));
    return () => { if (saveGuardTimer.current) clearTimeout(saveGuardTimer.current); };
  }, []);

  // ─── Login ─────────────────────────────────────────────────
  const login = useCallback(async () => {
    // TODO: Implement Supabase Auth
  }, []);

  // ─── Logout ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setState(s => ({
      ...s,
      session: null, isAuth: false, isAdmin: false,
      sessionId: null, messages: [], error: null,
    }));
  }, []);

  // ─── Nova sessão de chat ────────────────────────────────────
  const newSession = useCallback(async (title = 'Nova conversa') => {
    const sess = state.session;
    if (!sess) return null;
    L1Cache.current = [];
    setState(s => ({ ...s, sessionId: Date.now().toString(), messages: [] }));
    return Date.now().toString();
  }, [state.session, state.sessionId]);

  // ─── Adicionar mensagem ao cache L1 ────────────────────────
  const addMessage = useCallback((role: Message['role'], content: string) => {
    const msg: Message = {
      id:        crypto.randomUUID(),
      role,
      content,
      timestamp: Math.floor(Date.now() / 1000),
    };
    L1Cache.current = [...L1Cache.current, msg];
    setState(s => ({ ...s, messages: [...L1Cache.current] }));
    return msg;
  }, []);

  // ─── Flush manual (fim de sessão) ──────────────────────────
  const flushSession = useCallback(async () => {
    // TODO: Implement flush
  }, [state.session, state.sessionId]);

  // ─── Buscar memória por camada ─────────────────────────────
  const searchMemory = useCallback(async (
    query: string,
    layer: MemoryLayer = 'L2'
  ) => {
    const sess = state.session;
    if (!sess) return [];
    // L1: busca local imediata
    if (layer === 'L1') {
      return L1Cache.current.filter(m =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );
    }
    // L2/L3: Supabase
    return memoryService.search(sess.user_id, query, layer);
  }, [state.session]);

  // ─── Refresh token automático ──────────────────────────────
  const ensureToken = useCallback(async (): Promise<string | null> => {
    return null;
  }, [state.session]);

  // ─── Metadados ─────────────────────────────────────────────
  const setMeta = useCallback(async (key: string, value: string) => {
    const sess = state.session;
    if (!sess) return;
  }, [state.session]);

  return {
    // Estado
    ...state,
    l1Messages: L1Cache.current,
    // Auth
    login,
    logout,
    ensureToken,
    // Sessão
    newSession,
    flushSession,
    // Mensagens
    addMessage,
    // Memória
    searchMemory,
    // Metadata
    setMeta,
  };
}

export type JarvisHook = ReturnType<typeof useJarvis>;
