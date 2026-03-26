import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, AlertCircle } from 'lucide-react';
import { syncService } from '../services/syncService';
import { memoryService } from '../services/memoryService';
import { searchService } from '../services/searchService';
import { youtubeService } from '../services/youtubeService';

interface SyncSidebarProps {
  uid: string;
}

export const SyncSidebar: React.FC<SyncSidebarProps> = ({ uid }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ memory: 0, search: 0, youtube: 0, sessions: 0 });

  const fetchCounts = async () => {
    const [sessions, memory, search, youtube] = await Promise.all([
      memoryService.getSessions(uid),
      memoryService.getMemoryLayer(uid, 'all'),
      searchService.getHistory(uid),
      youtubeService.getYouTubeVideos(uid)
    ]);
    setCounts({
      sessions: sessions.length,
      memory: memory.length,
      search: search.length,
      youtube: youtube.length
    });
  };

  useEffect(() => {
    fetchCounts();
  }, [uid]);

  const handleSync = async () => {
    setIsSyncing(true);
    setProgress(20);
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress(p => p < 90 ? p + 10 : 90);
    }, 300);

    try {
      await syncService.syncAll(uid);
      setProgress(100);
      await fetchCounts();
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsSyncing(false);
        setProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="p-4 border-t border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sincronização</h3>
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className={`p-1.5 rounded-lg transition-colors ${isSyncing ? 'text-zinc-600' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isSyncing && (
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 bg-zinc-800/50 rounded-lg" title={`${counts.sessions} sessões`}>
          <div className="text-[10px] text-zinc-400">Sessões</div>
          <div className="text-sm font-bold">{counts.sessions}</div>
        </div>
        <div className="p-2 bg-zinc-800/50 rounded-lg" title={`${counts.memory} notas de voz`}>
          <div className="text-[10px] text-zinc-400">Notas</div>
          <div className="text-sm font-bold">{counts.memory}</div>
        </div>
        <div className="p-2 bg-zinc-800/50 rounded-lg" title={`${counts.search} buscas`}>
          <div className="text-[10px] text-zinc-400">Buscas</div>
          <div className="text-sm font-bold">{counts.search}</div>
        </div>
        <div className="p-2 bg-zinc-800/50 rounded-lg" title={`${counts.youtube} vídeos`}>
          <div className="text-[10px] text-zinc-400">YouTube</div>
          <div className="text-sm font-bold">{counts.youtube}</div>
        </div>
      </div>
    </div>
  );
};
