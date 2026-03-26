import { apiFetch } from './apiClient';
import { localCacheService } from './localCacheService';

export interface PersistenceEntry {
  id: string;
  uid: string;
  type: string;
  data: any;
  timestamp: number;
}

class PersistenceService {
  private memoryCache: PersistenceEntry[] = [];
  private readonly CACHE_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB
  private isSyncing = false;

  constructor() {
    // Load from localStorage on init to ensure session persistence
    this.loadFromLocal();
  }

  private loadFromLocal() {
    const saved = localStorage.getItem('jarvis_memory_cache');
    if (saved) {
      try {
        this.memoryCache = JSON.parse(saved);
      } catch (e) {
        console.error('Error loading memory cache:', e);
        this.memoryCache = [];
      }
    }
  }

  private saveToLocal() {
    localStorage.setItem('jarvis_memory_cache', JSON.stringify(this.memoryCache));
  }

  private calculateCacheSize(): number {
    return new Blob([JSON.stringify(this.memoryCache)]).size;
  }

  async save(uid: string, type: string, data: any) {
    const entry: PersistenceEntry = {
      id: Math.random().toString(36).substring(7),
      uid,
      type,
      data,
      timestamp: Date.now()
    };

    // Cascade Level 1: Memory Cache
    this.memoryCache.push(entry);
    
    // Cascade Level 2: LocalStorage (Session Persistence)
    this.saveToLocal();

    // Check if cache is full
    if (this.calculateCacheSize() >= this.CACHE_LIMIT_BYTES) {
      await this.syncToSupabase();
    } else {
      // Optimistic background sync for individual items if not full
      this.syncItem(entry).catch(console.error);
    }
  }

  private async syncItem(entry: PersistenceEntry) {
    try {
      await apiFetch('/api/db/generic_save', {
        method: 'POST',
        body: JSON.stringify(entry)
      });
    } catch (e) {
      console.warn('Background sync failed, will retry in bulk later.');
    }
  }

  async syncToSupabase() {
    if (this.isSyncing || this.memoryCache.length === 0) return;
    this.isSyncing = true;

    try {
      const response = await apiFetch('/api/db/bulk_sync', {
        method: 'POST',
        body: JSON.stringify({ entries: this.memoryCache })
      });

      if (response.ok) {
        // Clear cache after successful sync
        this.memoryCache = [];
        this.saveToLocal();
        console.log('JARVIS: Cache transferido para Supabase com sucesso.');
      }
    } catch (error) {
      console.error('JARVIS: Erro ao transferir cache para Supabase:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async exportAllData(uid: string) {
    try {
      const response = await apiFetch(`/api/db/export_all/${uid}`);
      const data = await response.json();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jesus_ia_export_${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  // Workspace Sync Placeholder
  async syncWorkspace(uid: string) {
    console.log('JARVIS: Sincronizando com Google Workspace...');
    try {
      const response = await apiFetch('/api/workspace/sync', {
        method: 'POST',
        body: JSON.stringify({ uid })
      });
      return await response.json();
    } catch (error) {
      console.error('Error syncing workspace:', error);
      throw error;
    }
  }
}

export const persistenceService = new PersistenceService();
