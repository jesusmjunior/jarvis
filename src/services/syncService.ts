import { apiFetch } from './apiClient';
import { localCacheService } from './localCacheService';
import { errorService, ErrorCategory } from './errorService';

export interface SyncQueue {
  sessions: any[];
  memory: any[];
  searches: any[];
  youtube: any[];
  cards: any[];
  maps: any[];
  photos: any[];
}

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'pulling' | 'completed' | 'error';
  progress: number;
  message: string;
  type: 'upload' | 'download' | 'both';
}

export interface SyncResult {
  success: boolean;
  message: string;
  results?: any;
}

const QUEUE_KEY = 'jarvis_sync_queue';

export const syncService = {
  getQueue: (): SyncQueue => {
    return localCacheService.get(QUEUE_KEY) || {
      sessions: [],
      memory: [],
      searches: [],
      youtube: [],
      cards: [],
      maps: [],
      photos: []
    };
  },

  addToQueue: (type: keyof SyncQueue, item: any) => {
    const queue = syncService.getQueue();
    // Use upsert logic in queue
    const index = queue[type].findIndex((i: any) => (i.id === item.id || (type === 'youtube' && i.videoId === item.videoId)));
    if (index >= 0) {
      queue[type][index] = { ...queue[type][index], ...item };
    } else {
      queue[type].push(item);
    }
    localCacheService.set(QUEUE_KEY, queue);
  },

  sync: async (onProgress?: (progress: SyncProgress) => void) => {
    const queue = syncService.getQueue();
    const count = Object.values(queue).reduce((sum, arr) => sum + arr.length, 0);
    
    if (count === 0) return { success: true, message: 'Nada para sincronizar.' };

    onProgress?.({ status: 'syncing', progress: 0, message: `Enviando ${count} itens para o Supabase...`, type: 'upload' });

    try {
      const res = await apiFetch('/api/db/sync', {
        method: 'POST',
        body: JSON.stringify(queue)
      });
      
      if (!res.ok) throw new Error('Falha na sincronização com o servidor.');
      
      const results = await res.json();
      
      // Clear queue on success
      localCacheService.remove(QUEUE_KEY);
      
      onProgress?.({ status: 'syncing', progress: 100, message: 'Upload concluído!', type: 'upload' });

      return { 
        success: true, 
        message: `Sincronizado: ${results.sessions} sessões, ${results.memory} mensagens, ${results.searches} buscas, ${results.youtube} vídeos, ${results.cards} notas, ${results.maps} mapas, ${results.photos} fotos.`,
        results 
      };
    } catch (error: any) {
      onProgress?.({ status: 'error', progress: 0, message: `Erro no upload: ${error.message}`, type: 'upload' });
      errorService.log(error, ErrorCategory.DATABASE, 'Erro durante a sincronização manual.');
      return { success: false, message: 'Erro ao sincronizar. Tente novamente.' };
    }
  },

  pull: async (uid: string, onProgress?: (progress: SyncProgress) => void) => {
    console.log(`JARVIS Sync: Iniciando pull para UID: ${uid}`);
    onProgress?.({ status: 'pulling', progress: 0, message: 'Buscando dados remotos...', type: 'download' });
    try {
      // We don't need to manually update everything here because the services 
      // already fetch from the API and update their own caches.
      // But calling them ensures the local cache is fresh.
      const { memoryService } = await import('./memoryService');
      const { searchService } = await import('./searchService');
      const { youtubeService } = await import('./youtubeService');

      const tasks = [
        { name: 'Sessões', fn: () => memoryService.getSessions(uid) },
        { name: 'Histórico de Busca', fn: () => searchService.getHistory(uid) },
        { name: 'Vídeos do YouTube', fn: () => youtubeService.getYouTubeVideos(uid) },
        { name: 'Mapas', fn: () => apiFetch(`/api/db/maps/${uid}`).then(r => r.json()) },
        { name: 'Fotos', fn: () => apiFetch(`/api/db/photos/${uid}`).then(r => r.json()) }
      ];

      for (let i = 0; i < tasks.length; i++) {
        onProgress?.({ 
          status: 'pulling', 
          progress: Math.round(((i + 1) / tasks.length) * 100), 
          message: `Baixando ${tasks[i].name}...`, 
          type: 'download' 
        });
        await tasks[i].fn();
      }

      onProgress?.({ status: 'completed', progress: 100, message: 'Download concluído!', type: 'download' });

      return { success: true, message: 'Dados atualizados do servidor.' };
    } catch (error: any) {
      onProgress?.({ status: 'error', progress: 0, message: `Erro no download: ${error.message}`, type: 'download' });
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao buscar dados do servidor.');
      return { success: false, message: 'Erro ao buscar dados. Verifique sua conexão.' };
    }
  },

  syncAll: async (uid: string, onProgress?: (progress: SyncProgress) => void) => {
    onProgress?.({ status: 'syncing', progress: 0, message: 'Iniciando sincronização total...', type: 'both' });
    
    // 1. Push local changes
    const pushResult = await syncService.sync(onProgress);
    
    // 2. Pull remote changes
    const pullResult = await syncService.pull(uid, onProgress);
    
    if (pullResult.success) {
      onProgress?.({ status: 'completed', progress: 100, message: 'Sincronização completa!', type: 'both' });
    }

    return {
      success: pushResult.success && pullResult.success,
      message: pushResult.success ? (pushResult.message === 'Nada para sincronizar.' ? pullResult.message : pushResult.message) : pushResult.message
    };
  },

  getPendingCount: (): number => {
    const queue = syncService.getQueue();
    return Object.values(queue).reduce((sum, arr) => sum + arr.length, 0);
  }
};
