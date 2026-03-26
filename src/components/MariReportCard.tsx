import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Square, Copy, Archive, Trash2, ChevronDown, ChevronUp, ExternalLink, Youtube, Volume2, VolumeX, Download, Zap, BookOpen, Search, CheckSquare, Share2, X, Layout } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { whiteboardManager } from '../utils/WhiteboardManager';

interface MariReportCardProps {
  id: string;
  title: string;
  content: string;
  sources: { title: string; uri: string }[];
  youtubeVideos?: any[];
  onSave: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onView?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const MariReportCard: React.FC<MariReportCardProps> = ({
  id,
  title,
  content,
  sources,
  youtubeVideos = [],
  onSave,
  onDelete,
  onCopy,
  onView,
  isMaximized = false,
  onToggleMaximize
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const startTTS = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = ttsSpeed;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const stopTTS = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (isPlaying && utteranceRef.current) {
      stopTTS();
      startTTS();
    }
  }, [ttsSpeed]);

  const publishToHashnode = async () => {
    setIsPublishing(true);
    // Placeholder for actual Hashnode API call
    setTimeout(() => {
      setIsPublishing(false);
      alert('Publicado com sucesso no Hashnode!');
    }, 1500);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: isMaximized ? 1.02 : 1,
        zIndex: isMaximized ? 40 : 1
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-white text-zinc-900 border border-zinc-200 rounded-lg shadow-2xl overflow-hidden transition-all duration-500 ${isMaximized ? 'fixed inset-4 z-50 overflow-y-auto' : 'relative'}`}
    >
      {/* Top Bar - Revista Eletrônica Style */}
      <div className="px-6 py-3 border-b border-zinc-200 flex items-center justify-between bg-zinc-50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center border border-indigo-200">
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-800 tracking-tight block">Revista Eletrônica</span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-medium">Protocolo Mari</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={publishToHashnode}
            disabled={isPublishing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors disabled:opacity-50"
          >
            {isPublishing ? <span className="animate-pulse">Publicando...</span> : <><Share2 className="w-3 h-3" /> Publicar no Hashnode</>}
          </button>

          <div className="flex items-center gap-1 bg-zinc-200/50 rounded-md p-1">
            <button 
              onClick={() => {
                whiteboardManager.send({ 
                  type: 'ADD_CARD', 
                  card: { id, type: 'report', title, content } 
                });
              }}
              className="p-1.5 hover:bg-zinc-200 text-zinc-600 rounded-md transition-all"
              title="Enviar para Lousa (Monitor B)"
            >
              <Layout className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onSave}
              className="p-1.5 hover:bg-zinc-200 text-zinc-600 rounded-md transition-all"
              title="Salvar no Banco"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onToggleMaximize}
              className="p-1.5 hover:bg-zinc-200 text-zinc-600 rounded-md transition-all"
              title={isMaximized ? "Minimizar" : "Maximizar"}
            >
              {isMaximized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <div className="w-px h-3 bg-zinc-300 mx-0.5" />
            <button 
              onClick={onDelete}
              className="p-1.5 hover:bg-red-100 text-zinc-600 hover:text-red-600 rounded-md transition-all"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {isMaximized && (
              <button 
                onClick={onToggleMaximize}
                className="p-1.5 hover:bg-zinc-200 text-zinc-600 rounded-md transition-all ml-1"
                title="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-8 md:p-12 bg-white"
          >
            {/* Metadata Row */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-100">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                Publicado em: {new Date().toLocaleDateString('pt-BR')}
              </div>
              
              <div className="flex items-center gap-2">
                {onView && (
                  <button 
                    onClick={onView}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors shadow-sm"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Ver Tela Cheia
                  </button>
                )}
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-md border border-zinc-200">
                  <button 
                    onClick={isPlaying ? stopTTS : startTTS}
                    className="p-1.5 hover:bg-white text-zinc-600 rounded-md transition-colors shadow-sm"
                    title={isPlaying ? "Parar Leitura" : "Iniciar Leitura"}
                  >
                    {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  </button>
                  <button onClick={stopTTS} className="p-1.5 hover:bg-white text-zinc-600 rounded-md transition-colors shadow-sm" title="Pausar">
                    <Pause className="w-3 h-3" />
                  </button>
                  <div className="w-px h-3 bg-zinc-300 mx-1" />
                  <select 
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="bg-transparent text-[10px] font-bold text-zinc-600 focus:outline-none cursor-pointer px-1"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="0.8">0.8x</option>
                    <option value="1">1.0x</option>
                    <option value="1.2">1.2x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2.0x</option>
                  </select>
                </div>

                <button 
                  onClick={onCopy}
                  className="p-2 hover:bg-zinc-100 text-zinc-600 rounded-md transition-colors border border-zinc-200"
                  title="Copiar Texto"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Title Section */}
            <div className="max-w-4xl mx-auto mb-12">
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 leading-[1.1] tracking-tight mb-8">
                {title}
              </h1>
              
              {/* Featured Image Placeholder or First YouTube Video */}
              {youtubeVideos.length > 0 ? (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-zinc-200 mb-12 shadow-lg relative group bg-black">
                  {activeVideo === youtubeVideos[0].id ? (
                    <iframe 
                      src={`https://www.youtube.com/embed/${youtubeVideos[0].id}?autoplay=1`} 
                      className="w-full h-full" 
                      allow="autoplay; encrypted-media" 
                      allowFullScreen 
                    />
                  ) : (
                    <>
                      <img 
                        src={`https://img.youtube.com/vi/${youtubeVideos[0].id}/maxresdefault.jpg`} 
                        alt={title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => setActiveVideo(youtubeVideos[0].id)}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                          <Play className="w-8 h-8 text-white fill-current ml-1" />
                        </div>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="h-1 w-24 bg-indigo-600 mb-12" />
              )}

              {/* Content area with Protocolo Mari styling */}
              <div className="max-w-3xl text-zinc-800">
                <MarkdownRenderer content={content} isMariReport={true} />
              </div>

              {/* Sources Section */}
              <div className="mt-16 pt-8 border-t border-zinc-200">
                <button 
                  onClick={() => setIsSourcesCollapsed(!isSourcesCollapsed)}
                  className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] hover:text-indigo-600 transition-colors flex items-center gap-2"
                >
                  {isSourcesCollapsed ? 'Mostrar Fontes Consultadas' : 'Ocultar Fontes Consultadas'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${isSourcesCollapsed ? '' : 'rotate-180'}`} />
                </button>
                
                <AnimatePresence>
                  {!isSourcesCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                      {sources.map((source, idx) => (
                        <a 
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                        >
                          <span className="text-[10px] font-mono text-indigo-400 group-hover:text-indigo-600">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="text-[11px] text-zinc-600 truncate group-hover:text-zinc-900 transition-colors">{source.title}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400 ml-auto group-hover:text-indigo-500" />
                        </a>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
