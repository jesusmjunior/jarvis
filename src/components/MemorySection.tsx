import React, { useState, useEffect } from 'react';
import { Archive, Trash2, History, X, Search, Calendar, Clock, MessageSquare, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { memoryService, ChatSession, MemoryEntry } from '../services/memoryService';

interface MemorySectionProps {
  uid: string;
  onClose: () => void;
  onRestore: (sessionId: string) => void;
}

const MemorySection: React.FC<MemorySectionProps> = ({ uid, onClose, onRestore }) => {
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<MemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const LIMIT = 20;
  const MSG_LIMIT = 50;

  useEffect(() => {
    loadArchived(true);
  }, [uid]);

  const loadArchived = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
      setOffset(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    const currentOffset = isInitial ? 0 : offset;
    const data = await memoryService.getArchivedSessions(uid, LIMIT, currentOffset);
    
    if (isInitial) {
      setArchivedSessions(data);
    } else {
      setArchivedSessions(prev => [...prev, ...data]);
    }

    setHasMore(data.length === LIMIT);
    setOffset(prev => prev + data.length);
    setIsLoading(false);
    setIsLoadingMore(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && !isLoadingMore && hasMore && !searchTerm) {
      loadArchived();
    }
  };

  const loadMessages = async (sessionId: string, isInitial = false) => {
    if (isInitial) {
      setIsLoadingMessages(true);
      setMessagesOffset(0);
      setHasMoreMessages(true);
      setSessionMessages([]);
    } else {
      setIsLoadingMoreMessages(true);
    }

    const currentOffset = isInitial ? 0 : messagesOffset;
    const messages = await memoryService.getSessionMessages(uid, sessionId, MSG_LIMIT, currentOffset);
    
    if (isInitial) {
      setSessionMessages(messages);
    } else {
      setSessionMessages(prev => [...prev, ...messages]);
    }

    setHasMoreMessages(messages.length === MSG_LIMIT);
    setMessagesOffset(prev => prev + messages.length);
    setIsLoadingMessages(false);
    setIsLoadingMoreMessages(false);
  };

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50 && !isLoadingMoreMessages && hasMoreMessages && selectedSession) {
      loadMessages(selectedSession.id);
    }
  };

  const handleUnarchive = async (sessionId: string) => {
    if (await memoryService.unarchiveSession(uid, sessionId)) {
      setArchivedSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) setSelectedSession(null);
      onRestore(sessionId);
    }
  };

  const filteredSessions = archivedSessions.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-0 top-0 bottom-0 w-[500px] bg-zinc-950 border-l border-white/10 z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Archive className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Memória do Sistema</h2>
            <p className="text-xs text-zinc-500">Cards de chat arquivados e preservados</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Pesquisar na memória..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar p-4"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Acessando arquivos...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="p-4 bg-zinc-900 rounded-full">
              <Archive className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-zinc-400 font-medium">Memória vazia</p>
              <p className="text-xs text-zinc-600 mt-1">Arquive conversas para preservá-las permanentemente aqui.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((session) => (
              <div 
                key={session.id}
                onClick={() => {
                  setSelectedSession(session);
                  loadMessages(session.id, true);
                }}
                className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 relative z-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Arquivado em: {new Date(session.archivedAt || 0).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-white transition-colors">
                      {session.title}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {session.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded-md text-zinc-500">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleUnarchive(session.id); }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-lg transition-all text-zinc-600"
                    title="Restaurar para o Chat"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                {/* Visual indicator of "archived card" */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 blur-2xl rounded-full -mr-8 -mt-8" />
              </div>
            ))}
            
            {isLoadingMore && (
              <div className="flex justify-center p-4">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-zinc-950 z-10 flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <button onClick={() => setSelectedSession(null)} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">
                <ChevronRight className="w-4 h-4 rotate-180" />
                Voltar à Memória
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleUnarchive(selectedSession.id)}
                  className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-full transition-colors"
                  title="Restaurar"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div 
              className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6"
              onScroll={handleMessagesScroll}
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedSession.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(selectedSession.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {selectedSession.title}
                </h2>
              </div>

              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-zinc-500">Recuperando mensagens...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessionMessages.map((msg, i) => (
                    <div key={i} className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-white/5 border border-white/5' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {msg.role === 'user' ? <div className="w-5 h-5 rounded-full bg-zinc-700" /> : <div className="w-5 h-5 rounded-full bg-emerald-500" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                          {msg.role === 'user' ? 'Usuário' : 'JESUS I.A.'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                  ))}

                  {isLoadingMoreMessages && (
                    <div className="flex justify-center p-4">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MemorySection;
