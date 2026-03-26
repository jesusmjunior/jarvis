import { errorService, ErrorCategory } from './errorService';
import { localCacheService } from './localCacheService';
import { storageService } from './storageService';
import { apiFetch } from './apiClient';
import { syncService } from './syncService';

export interface SearchEntry {
  id?: string;
  uid: string;
  sessionId?: string;
  query: string;
  type: 'web' | 'youtube' | 'drive' | 'map' | 'photos';
  results: any[];
  timestamp: number;
  tags?: string[];
  summary?: string;
}

// In-memory cache for session persistence
const memoryCache: Record<string, SearchEntry[]> = {};

export type PersistenceMode = 'memory' | 'local' | 'drive';

export const searchService = {
  saveSearch: async (uid: string, entry: Omit<SearchEntry, 'uid' | 'timestamp'>, mode: PersistenceMode = 'memory') => {
    const newEntry: SearchEntry = {
      ...entry,
      uid,
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(7)
    };

    // 1. Memory Cache (Always)
    if (!memoryCache[uid]) memoryCache[uid] = [];
    memoryCache[uid] = [newEntry, ...memoryCache[uid]].slice(0, 100);

    // 2. Add to Sync Queue
    syncService.addToQueue('searches', newEntry);

    // 3. Backend API (Permanent - Optimistic)
    try {
      const res = await apiFetch('/api/db/search', {
        method: 'POST',
        body: JSON.stringify(newEntry)
      });
      const data = await res.json();
      return data.id || newEntry.id;
    } catch (error) {
      console.warn('Falha no salvamento imediato da busca, ficará na fila de sincronização.');
      return newEntry.id;
    }
  },

  getHistory: async (uid: string, limit: number = 50, offset: number = 0, mode: PersistenceMode = 'memory'): Promise<SearchEntry[]> => {
    // 1. Try Memory Cache first (only if it's the first page)
    if (offset === 0 && memoryCache[uid] && memoryCache[uid].length > 0) {
      return memoryCache[uid].slice(0, limit);
    }

    // 2. Fallback to Backend API
    try {
      const res = await apiFetch(`/api/db/search/${uid}?limit=${limit}&offset=${offset}`);
      const data = await res.json();
      const history = data as SearchEntry[];
      
      if (offset === 0) {
        memoryCache[uid] = history;
      }
      
      return history;
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar histórico de busca.');
      return [];
    }
  },

  deleteSearch: async (id: string, uid: string, mode: PersistenceMode = 'memory') => {
    // Remove from memory
    if (memoryCache[uid]) {
      memoryCache[uid] = memoryCache[uid].filter(c => c.id !== id);
    }

    // Remove from Backend API
    try {
      await apiFetch(`/api/db/search/${id}`, { method: 'DELETE' });
      return true;
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao deletar busca.');
      return false;
    }
  },

  getSearchContext: async (uid: string): Promise<string> => {
    try {
      const history = await searchService.getHistory(uid, 10, 0);
      if (history.length === 0) return "";

      return `\n--- HISTÓRICO DE BUSCAS RECENTES ---\n${history.map(s => 
        `- [${new Date(s.timestamp).toLocaleDateString()}] (${s.type}) "${s.query}": ${s.summary || 'Busca realizada.'}`
      ).join('\n')}\n`;
    } catch (error) {
      return "";
    }
  },

  getMainTheme: async (uid: string): Promise<string> => {
    const history = await searchService.getHistory(uid, 50, 0);
    if (history.length === 0) return 'Geral';
    
    const keywords: Record<string, number> = {};
    history.forEach(entry => {
      const words = entry.query.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          keywords[word] = (keywords[word] || 0) + 1;
        }
      });
      entry.tags?.forEach(tag => {
        keywords[tag] = (keywords[tag] || 0) + 2; // Tags weigh more
      });
    });
    
    const sorted = Object.entries(keywords).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'Geral';
  }
};

