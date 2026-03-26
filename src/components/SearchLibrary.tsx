import React, { useState, useEffect } from 'react';
import { Search, Trash2, ExternalLink, Calendar, Tag, Youtube, FileText, Globe, X, ChevronRight, Clock, History, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { searchService, SearchEntry } from '../services/searchService';

interface SearchLibraryProps {
  uid: string;
  onClose: () => void;
  isLocalStorageEnabled?: boolean;
  onPlayVideo: (url: string, title?: string) => void;
}

const SearchLibrary: React.FC<SearchLibraryProps> = ({ uid, onClose, isLocalStorageEnabled = false, onPlayVideo }) => {
  const [history, setHistory] = useState<SearchEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'web' | 'youtube' | 'drive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSearchIndex, setSelectedSearchIndex] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  useEffect(() => {
    loadHistory(true);
  }, [uid, isLocalStorageEnabled, filter]);

  const loadHistory = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
      setOffset(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    const mode: 'local' | 'memory' = isLocalStorageEnabled ? 'local' : 'memory';
    const currentOffset = isInitial ? 0 : offset;
    const data = await searchService.getHistory(uid, LIMIT, currentOffset, mode);
    
    // Filter by type if not 'all' (though the backend should ideally handle this, 
    // for now we'll do it here if needed, but the backend returns all for now)
    const filteredData = filter === 'all' ? data : data.filter(s => s.type === filter);

    if (isInitial) {
      setHistory(data);
    } else {
      setHistory(prev => [...prev, ...data]);
    }

    setHasMore(data.length === LIMIT);
    setOffset(prev => prev + data.length);
    setIsLoading(false);
    setIsLoadingMore(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && !isLoadingMore && hasMore && !searchTerm) {
      loadHistory();
    }
  };

  const filteredHistory = history.filter(s => {
    const matchesFilter = filter === 'all' || s.type === filter;
    const matchesSearch = s.query.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (s.summary && s.summary.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const selectedSearch = selectedSearchIndex !== null ? filteredHistory[selectedSearchIndex] : null;

  const handleNext = () => {
    if (selectedSearchIndex !== null && selectedSearchIndex < filteredHistory.length - 1) {
      setSelectedSearchIndex(selectedSearchIndex + 1);
    }
  };

  const handlePrev = () => {
    if (selectedSearchIndex !== null && selectedSearchIndex > 0) {
      setSelectedSearchIndex(selectedSearchIndex - 1);
    }
  };

  const handleDelete = async (id: string) => {
    const mode: 'local' | 'memory' = isLocalStorageEnabled ? 'local' : 'memory';
    if (await searchService.deleteSearch(id, uid, mode)) {
      setHistory(prev => prev.filter(s => s.id !== id));
      if (selectedSearch?.id === id) setSelectedSearchIndex(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 bottom-0 w-[450px] bg-zinc-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <History className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Biblioteca de Pesquisas</h2>
            <p className="text-xs text-zinc-500">Memória de buscas do JESUS I.A.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Filters & Search */}
      <div className="p-4 space-y-4 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Pesquisar no histórico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {(['all', 'web', 'youtube', 'drive'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === t ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
            >
              {t === 'all' ? 'Tudo' : t === 'web' ? 'Web' : t === 'youtube' ? 'YouTube' : 'Drive'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar p-4"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Carregando biblioteca...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="p-4 bg-zinc-900 rounded-full">
              <Search className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-400 font-medium">Nenhuma pesquisa encontrada</p>
              <p className="text-xs text-zinc-600 mt-1">As pesquisas que você realizar com o JESUS I.A. aparecerão aqui.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((search) => (
              <div 
                key={search.id}
                onClick={() => setSelectedSearchIndex(filteredHistory.indexOf(search))}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedSearchIndex !== null && filteredHistory[selectedSearchIndex]?.id === search.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-zinc-900/50 border-white/5 hover:border-white/10'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {search.type === 'web' && <Globe className="w-3 h-3 text-emerald-400" />}
                      {search.type === 'youtube' && <Youtube className="w-3 h-3 text-red-400" />}
                      {search.type === 'drive' && <FileText className="w-3 h-3 text-blue-400" />}
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                        {new Date(search.timestamp).toLocaleDateString()} • {new Date(search.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                      {search.query}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                      {search.summary || 'Sem resumo disponível.'}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(search.id!); }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all text-zinc-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {isLoadingMore && (
              <div className="flex justify-center p-4">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedSearch && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-zinc-950 z-10 flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <button onClick={() => setSelectedSearchIndex(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                <ChevronRight className="w-4 h-4 rotate-180" />
                Voltar
              </button>
              <div className="flex items-center gap-2">
                <button onClick={handlePrev} disabled={selectedSearchIndex === 0} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 disabled:opacity-50">
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <button onClick={handleNext} disabled={selectedSearchIndex === filteredHistory.length - 1} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 disabled:opacity-50">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(selectedSearch.id!)}
                  className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <motion.div
              key={selectedSearch.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(event, info) => {
                if (info.offset.x > 50) handlePrev();
                else if (info.offset.x < -50) handleNext();
              }}
              className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold rounded uppercase tracking-wider">
                    {selectedSearch.type}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(selectedSearch.timestamp).toLocaleString()}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white leading-tight">
                  {selectedSearch.query}
                </h2>
              </div>

              <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Resumo da IA
                </h4>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {selectedSearch.summary || 'Nenhum resumo gerado para esta busca.'}
                </p>
              </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" />
                    Resultados Encontrados ({selectedSearch.results?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {selectedSearch.results?.map((res: any, i: number) => {
                      const link = res.uri || res.link || res.webViewLink || (res.id ? `https://www.youtube.com/watch?v=${res.id}` : null);
                      const title = res.title || res.displayName || res.name;
                      const isYoutube = selectedSearch.type === 'youtube' || (link && (link.includes('youtube.com') || link.includes('youtu.be') || link.includes('vimeo.com')));

                      return (
                        <div 
                          key={i}
                          className="block p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 hover:border-indigo-500/30 transition-all group cursor-pointer"
                          onClick={() => {
                            if (isYoutube && link) {
                              onPlayVideo(link, title);
                            } else if (link) {
                              window.open(link, '_blank');
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium text-zinc-200 group-hover:text-indigo-300 transition-colors line-clamp-1">
                              {title}
                            </h5>
                            {isYoutube && <Play className="w-3 h-3 text-red-500" />}
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate mt-1">
                            {link || 'Link não disponível'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SearchLibrary;
