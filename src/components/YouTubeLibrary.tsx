import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Youtube, X, Search, ExternalLink, Play, Clock, Calendar, Trash2, Filter, ChevronRight, Zap, Bookmark, History as HistoryIcon, Layout } from 'lucide-react';
import { searchService, SearchEntry } from '../services/searchService';
import { youtubeService } from '../services/youtubeService';
import { whiteboardManager } from '../utils/WhiteboardManager';

interface YouTubeLibraryProps {
  uid: string;
  sessionId: string | null;
  onClose: () => void;
  isLocalStorageEnabled?: boolean;
  onPlayVideo: (url: string, title?: string) => void;
}

export default function YouTubeLibrary({ uid, sessionId, onClose, isLocalStorageEnabled, onPlayVideo }: YouTubeLibraryProps) {
  const [history, setHistory] = useState<SearchEntry[]>([]);
  const [savedVideos, setSavedVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'history' | 'saved'>('history');

  useEffect(() => {
    loadData();
  }, [uid]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load history
      const allHistory = await searchService.getHistory(uid, 100, 0, isLocalStorageEnabled ? 'local' : 'memory');
      const youtubeHistory = allHistory.filter(entry => entry.type === 'youtube');
      setHistory(youtubeHistory);

      // Load saved videos
      const saved = await youtubeService.getYouTubeVideos(uid);
      setSavedVideos(saved);
    } catch (error) {
      console.error('Error loading YouTube data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (await searchService.deleteSearch(id, uid, isLocalStorageEnabled ? 'local' : 'memory')) {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await youtubeService.deleteYouTubeVideo(id);
      setSavedVideos(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting saved video:', error);
    }
  };

  const filteredHistory = history.filter(entry => 
    entry.query.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const allHistoryVideos = filteredHistory.flatMap(entry => 
    entry.results.map(v => ({ 
      ...v, 
      searchId: entry.id, 
      query: entry.query, 
      timestamp: entry.timestamp,
      isSaved: savedVideos.some(s => s.id === v.id)
    }))
  );

  const filteredSavedVideos = savedVideos.filter(video => 
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.channelTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveVideo = async (video: any) => {
    try {
      await youtubeService.saveYouTubeVideo(uid, {
        ...video,
        sessionId: sessionId || undefined
      });
      const updatedSaved = await youtubeService.getYouTubeVideos(uid);
      setSavedVideos(updatedSaved);
    } catch (error) {
      console.error('Error saving video:', error);
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-2xl bg-zinc-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-xl">
            <Youtube className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">YouTube Library</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Pesquisas e Vídeos Arquivados</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors group"
        >
          <X className="w-6 h-6 text-zinc-500 group-hover:text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-4 border-b border-white/5 bg-zinc-900/30">
        <button 
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'history' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2">
            <HistoryIcon className="w-3.5 h-3.5" />
            Histórico
          </div>
          {activeTab === 'history' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab('saved')}
          className={`pb-4 px-2 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'saved' ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <div className="flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5" />
            Salvos
          </div>
          {activeTab === 'saved' && (
            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
          )}
        </button>
      </div>

      {/* Search & Filter */}
      <div className="p-6 bg-zinc-900/30 border-b border-white/5 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'history' ? "Filtrar por tema ou palavra-chave..." : "Pesquisar nos vídeos salvos..."}
            className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-red-500/50 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
            <Youtube className="w-12 h-12 animate-pulse text-red-500" />
            <p className="text-sm font-medium">Sincronizando biblioteca...</p>
          </div>
        ) : (activeTab === 'history' ? allHistoryVideos : filteredSavedVideos).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
            <Youtube className="w-20 h-20" />
            <div>
              <p className="text-lg font-bold">Nenhum vídeo encontrado</p>
              <p className="text-sm">
                {activeTab === 'history' 
                  ? "Suas pesquisas no YouTube aparecerão aqui." 
                  : "Você ainda não salvou nenhum vídeo no banco de dados."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(activeTab === 'history' ? allHistoryVideos : filteredSavedVideos).map((video, idx) => (
              <motion.div 
                key={`${video.id}-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-zinc-900/50 rounded-xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all shadow-xl"
              >
                <div className="relative aspect-video overflow-hidden">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <button 
                      onClick={() => onPlayVideo(video.link, video.title)}
                      className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-2xl transform scale-0 group-hover:scale-100 transition-transform duration-300"
                    >
                      <Play className="w-5 h-5 text-white fill-current" />
                    </button>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-[8px] font-bold text-white">
                    {video.timestamp ? new Date(video.timestamp).toLocaleDateString() : 'Salvo'}
                  </div>
                </div>
                
                <div className="p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[10px] font-bold text-white line-clamp-2 leading-tight group-hover:text-red-400 transition-colors">
                      {video.title}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800 px-1.5 py-0.5 rounded-full">
                      {video.channelTitle}
                    </span>
                  </div>

                  {video.query && (
                    <p className="text-[8px] text-zinc-500 line-clamp-1 italic">
                      Busca: "{video.query}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => {
                          whiteboardManager.send({ 
                            type: 'ADD_CARD', 
                            card: { 
                              id: video.id, 
                              type: 'youtube', 
                              title: video.title, 
                              content: `### ${video.title}\n\n[VIDEO:https://www.youtube.com/watch?v=${video.id}]\n\nCanal: ${video.channelTitle}` 
                            } 
                          });
                        }}
                        className="p-1 text-zinc-600 hover:text-indigo-400 transition-colors"
                        title="Enviar para Lousa (Monitor B)"
                      >
                        <Layout className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => activeTab === 'history' ? handleDeleteHistory(video.searchId) : handleDeleteSaved(video.id)}
                        className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                        title={activeTab === 'history' ? "Excluir do Histórico" : "Remover dos Salvos"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {activeTab === 'history' && (
                        <button 
                          onClick={() => video.isSaved ? handleDeleteSaved(video.id) : handleSaveVideo(video)}
                          className={`p-1 transition-colors ${video.isSaved ? 'text-emerald-500 hover:text-red-500' : 'text-zinc-600 hover:text-emerald-500'}`}
                          title={video.isSaved ? "Remover dos Salvos" : "Salvar no Banco de Dados"}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${video.isSaved ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => onPlayVideo(video.link, video.title)}
                      className="text-[8px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1 hover:text-red-400"
                    >
                      Assistir <Play className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-zinc-900/50 border-t border-white/5">
        <div className="flex items-center gap-3 text-zinc-500">
          <Zap className="w-4 h-4 text-amber-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            {activeTab === 'history' 
              ? `${history.length} pesquisas arquivadas // ${allHistoryVideos.length} vídeos totais`
              : `${savedVideos.length} vídeos salvos no banco de dados`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
