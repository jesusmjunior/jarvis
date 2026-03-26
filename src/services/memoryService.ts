import { localCacheService } from './localCacheService';
import { storageService } from './storageService';
import { errorService, ErrorCategory } from './errorService';
import { getGeminiResponse } from './geminiChat';
import { PersistenceMode } from './searchService';
import { apiFetch } from './apiClient';
import { syncService } from './syncService';

export interface MemoryEntry {
  id: string;
  uid: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tags?: string[];
  metadata?: string;
}

export type MemoryLayer = 'L1' | 'L2' | 'L3' | 'L4';

export interface ChatSession {
  id: string;
  uid: string;
  title: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  isArchived?: boolean;
  archivedAt?: number;
}

// Layer 1: Session Cache (RAM)
let sessionCache: MemoryEntry[] = [];

export const memoryService = {
  save: async (uid: string, entry: Omit<MemoryEntry, 'uid' | 'id'> & { id?: string; sessionId?: string }, mode: PersistenceMode = 'memory') => {
    const newEntry: MemoryEntry = { 
      ...entry, 
      uid, 
      timestamp: Date.now(), 
      id: entry.id || Math.random().toString(36).substring(7),
      sessionId: entry.sessionId || 'default'
    } as MemoryEntry;
    
    // Layer 1: Update RAM
    sessionCache.push(newEntry);
    if (sessionCache.length > 100) sessionCache.shift();

    // Layer 2: Add to Sync Queue
    syncService.addToQueue('memory', newEntry);

    // Layer 3: Try Backend API (Optimistic)
    try {
      await apiFetch('/api/db/memory', {
        method: 'POST',
        body: JSON.stringify(newEntry)
      });
    } catch (error) {
      console.warn('Falha no salvamento imediato da memória, ficará na fila de sincronização.');
    }
  },

  saveSessionMetadata: async (uid: string, session: ChatSession, mode: PersistenceMode = 'memory') => {
    // 1. Add to Sync Queue
    syncService.addToQueue('sessions', session);

    // 2. Update local cache for immediate UI feedback
    const sessions = localCacheService.get(`sessions_${uid}`) || [];
    const index = sessions.findIndex((s: any) => s.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.unshift(session);
    localCacheService.set(`sessions_${uid}`, sessions);

    // 3. Try Backend API
    try {
      await apiFetch('/api/db/sessions', {
        method: 'POST',
        body: JSON.stringify(session)
      });
    } catch (error: any) {
      if (error.message && error.message.includes('Supabase not configured')) {
        console.warn('Supabase não configurado. Sessão salva localmente e na fila de sincronização.');
      } else {
        errorService.log(error, ErrorCategory.DATABASE, 'Erro ao salvar metadados da sessão (fila de sincronização ativa).');
      }
    }
  },

  getSessions: async (uid: string, limit: number = 50, offset: number = 0, mode: PersistenceMode = 'memory'): Promise<ChatSession[]> => {
    try {
      const res = await apiFetch(`/api/db/sessions/${uid}?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      const sessions = data.filter((s: any) => !s.is_archived && !s.isArchived) as ChatSession[];
      
      // Update local cache (only if it's the first page)
      if (offset === 0) {
        localCacheService.set(`sessions_${uid}`, sessions);
      }
      
      return sessions;
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar sessões.');
      // Fallback to local cache
      const cached = localCacheService.get(`sessions_${uid}`) || [];
      return cached.filter((s: any) => !s.is_archived && !s.isArchived);
    }
  },

  getArchivedSessions: async (uid: string, limit: number = 50, offset: number = 0, mode: PersistenceMode = 'memory'): Promise<ChatSession[]> => {
    try {
      const res = await apiFetch(`/api/db/sessions/${uid}?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      return data.filter((s: any) => s.is_archived || s.isArchived) as ChatSession[];
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar sessões arquivadas.');
      return [];
    }
  },

  archiveSession: async (uid: string, sessionId: string, mode: PersistenceMode = 'memory') => {
    try {
      const res = await apiFetch(`/api/db/sessions/${uid}`);
      const sessions = await res.json();
      const session = sessions.find((s: any) => s.id === sessionId);

      if (session) {
        const updatedSession = {
          ...session,
          is_archived: true,
          isArchived: true,
          archived_at: Date.now(),
          archivedAt: Date.now()
        };
        await apiFetch('/api/db/sessions', {
          method: 'POST',
          body: JSON.stringify(updatedSession)
        });
        return true;
      }
      return false;
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao arquivar sessão.');
      return false;
    }
  },

  unarchiveSession: async (uid: string, sessionId: string, mode: PersistenceMode = 'memory') => {
    try {
      const res = await apiFetch(`/api/db/sessions/${uid}`);
      const sessions = await res.json();
      const session = sessions.find((s: any) => s.id === sessionId);

      if (session) {
        const updatedSession = {
          ...session,
          is_archived: false,
          isArchived: false,
          archived_at: null,
          archivedAt: null
        };
        await apiFetch('/api/db/sessions', {
          method: 'POST',
          body: JSON.stringify(updatedSession)
        });
        return true;
      }
      return false;
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao desarquivar sessão.');
      return false;
    }
  },

  getSessionMessages: async (uid: string, sessionId: string, limit: number = 100, offset: number = 0, mode: PersistenceMode = 'memory'): Promise<MemoryEntry[]> => {
    try {
      const res = await apiFetch(`/api/db/memory/${sessionId}?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      return data as MemoryEntry[];
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar mensagens da sessão.');
      return [];
    }
  },

  generateSessionMetadata: async (messages: (Partial<MemoryEntry> & { role: string, content: string })[], apiKey: string): Promise<{ title: string, tags: string[] }> => {
    try {
      const prompt = `Analise a seguinte conversa e gere um título curto (máx 5 palavras) e 3 tags relevantes.
Retorne APENAS um JSON válido no formato: {"title": "Título", "tags": ["tag1", "tag2", "tag3"]}

Conversa:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
`;
      const response = await getGeminiResponse(prompt, apiKey, "Você é um assistente que gera metadados JSON.");
      const text = response.text || "{}";
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);
      return {
        title: data.title || "Nova Conversa",
        tags: data.tags || ["geral"]
      };
    } catch (error) {
      console.error("Erro ao gerar metadados:", error);
      return { title: "Nova Conversa", tags: ["geral"] };
    }
  },

  // Layered Search
  get: async (uid: string, depth: 'week' | 'month' | 'all', limit: number = 100, offset: number = 0, mode: PersistenceMode = 'memory', onProgress?: (msg: string) => void) => {
    // Layer 1: Session Cache is always available in RAM
    
    if (depth === 'week') {
      onProgress?.('Carregando contexto recente...');
      const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      const res = await apiFetch(`/api/db/memory/all/${uid}?since=${startTime}&limit=${limit}&offset=${offset}`);
      return res.json();
    }

    if (depth === 'month') {
      onProgress?.('Buscando histórico do último mês...');
      const startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const res = await apiFetch(`/api/db/memory/all/${uid}?since=${startTime}&limit=${limit}&offset=${offset}`);
      return res.json();
    }

    if (depth === 'all') {
      onProgress?.('Iniciando varrimento total...');
      
      const res = await apiFetch(`/api/db/memory/all/${uid}?limit=${limit}&offset=${offset}`);
      return res.json();
    }

    return sessionCache;
  },

  export: async (uid: string, scope: 'metadata' | 'full' = 'metadata') => {
    const memory = await memoryService.get(uid, 'all');
    let dataToExport;

    if (scope === 'metadata') {
      dataToExport = {
        exportedAt: new Date().toISOString(),
        uid,
        sessions: memory.filter(m => m.role === 'assistant').map(m => ({
          id: m.id,
          date: new Date(m.timestamp).toLocaleDateString(),
          summary: m.content.substring(0, 100) + '...',
          timestamp: m.timestamp
        }))
      };
    } else {
      dataToExport = {
        exportedAt: new Date().toISOString(),
        uid,
        fullHistory: memory
      };
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `jarvis_memory_${scope}_${uid}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },

  import: async (uid: string, file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const entries = data.fullHistory || data.sessions || [];
          for (const entry of entries) {
            await memoryService.save(uid, entry);
          }
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  },

  getMemoryLayer: async (uid: string, depth: 'week' | 'month' | 'all', mode: PersistenceMode = 'memory', onProgress?: (msg: string) => void) => {
    switch (depth) {
      case 'week':
        return await memoryService.get(uid, 'week', 100, 0, mode, onProgress);
      case 'month':
        // Try local cache first
        const localKey = `memory_month_${uid}`;
        const cached = localCacheService.get(localKey);
        if (cached) return cached;
        
        const monthData = await memoryService.get(uid, 'month', 100, 0, mode, onProgress);
        localCacheService.set(localKey, monthData, 30 * 60 * 1000); // 30 mins
        return monthData;
      case 'all':
        return await memoryService.get(uid, 'all', 100, 0, mode, onProgress);
      default:
        return sessionCache;
    }
  },

  search: async (uid: string, query: string, layer: MemoryLayer) => {
    try {
      const res = await apiFetch(`/api/db/memory/all/${uid}`);
      const data = await res.json();
      return data.filter((m: any) => m.content && m.content.toLowerCase().includes(query.toLowerCase()));
    } catch (error) {
      console.error('Error searching memory:', error);
      return [];
    }
  },

  saveReport: async (uid: string, report: any) => {
    try {
      await apiFetch('/api/db/reports', {
        method: 'POST',
        body: JSON.stringify({ ...report, uid })
      });
      return true;
    } catch (error) {
      console.error('Error saving report:', error);
      return false;
    }
  }
};

// Legacy exports for compatibility during refactor
export const saveMemory = memoryService.save;
export const getMemory = (uid: string, depth: any, mode: PersistenceMode = 'memory') => memoryService.get(uid, depth, 100, 0, mode);
export const exportMemory = memoryService.export;
export const importMemory = memoryService.import;
export const getMemoryLayer = memoryService.getMemoryLayer;
