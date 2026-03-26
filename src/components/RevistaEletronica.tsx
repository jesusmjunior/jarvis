import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Square, X, BookOpen, Copy, Trash2, Search, Maximize2, Minimize2, Check, ChevronLeft, ChevronRight, ExternalLink, Download, Archive, Share2, FastForward } from 'lucide-react';
import { Report, archiveReport, publishToHashnode } from '../services/reportService';
import { ttsService } from '../services/ttsService';
import { GoogleGenAI } from "@google/genai";
import { MarkdownRenderer } from './MarkdownRenderer';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { useApiKey } from '../contexts/ApiKeyContext';
import { secrets } from '../config/secrets';

interface RevistaEletronicaProps {
  report: Report | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSave?: () => void;
  addNotification?: (message: string, type: 'info' | 'success' | 'error') => void;
}

export default function RevistaEletronica({ report, onClose, onNext, onPrev, onSave, addNotification }: RevistaEletronicaProps) {
  const { activeKey: apiKey } = useApiKey();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeApiKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey: activeApiKey });

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  if (!report) return null;

  const playTTS = async () => {
    if (isPlaying) {
      ttsService.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      await ttsService.speak(report.content, { rate: playbackRate });
    } catch (error) {
      console.error('TTS Error:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const stopTTS = () => {
    ttsService.stop();
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      playTTS();
    }
  }, [playbackRate]);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      if (onSave) {
        onSave();
      } else {
        await archiveReport(report);
        if (addNotification) addNotification('Reportagem arquivada com sucesso!', 'success');
      }
    } catch (e) {
      if (addNotification) addNotification('Erro ao arquivar reportagem.', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  const downloadPDF = async () => {
    if (!contentRef.current) return;
    setIsDownloading(true);
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');
      
      const content = contentRef.current.innerHTML;
      const title = report.title;
      
      if (iframe.contentWindow) {
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title}</title>
              ${styles}
              <style>
                @media print {
                  body { background: white !important; color: black !important; }
                  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  .no-print { display: none !important; }
                }
                body { padding: 2rem; background: white; color: black; }
              </style>
            </head>
            <body>
              ${content}
            </body>
          </html>
        `);
        doc.close();
        
        setTimeout(() => {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
          if (addNotification) addNotification('PDF gerado com sucesso!', 'success');
        }, 1000);
      }
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      if (addNotification) addNotification('Erro ao gerar PDF.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePublish = async () => {
    const token = localStorage.getItem('hashnodeToken');
    if (!token) {
      if (addNotification) addNotification('Por favor, configure o Token do Hashnode nas configurações.', 'error');
      return;
    }
    setIsPublishing(true);
    try {
      const success = await publishToHashnode(report, token);
      if (success) {
        if (addNotification) addNotification('Publicado com sucesso no Hashnode!', 'success');
      } else {
        if (addNotification) addNotification('Erro ao publicar no Hashnode. Verifique seu token.', 'error');
      }
    } catch (e) {
      if (addNotification) addNotification('Erro ao publicar: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 md:p-8"
    >
      <div className={`bg-black rounded-none border border-zinc-800 shadow-none overflow-hidden flex flex-col transition-all duration-150 ${isMaximized ? 'w-full h-full' : 'w-full max-w-5xl h-[90vh]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-emerald-500" />
            <h1 className="text-sm font-bold text-zinc-200">Revista Eletrônica</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-800 rounded-md px-2 py-1 gap-2 mr-4">
              <FastForward className="w-3 h-3 text-zinc-500" />
              <select 
                value={playbackRate} 
                onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                className="bg-transparent text-[10px] font-bold text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2.0x</option>
              </select>
            </div>

            <button onClick={handlePublish} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-md transition-colors">
              {isPublishing ? 'Publicando...' : <><Share2 className="w-3 h-3" /> Publicar</>}
            </button>
            <button onClick={handleArchive} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold rounded-md transition-colors">
              {isArchiving ? 'Arquivando...' : <><Archive className="w-3 h-3" /> Arquivar</>}
            </button>
            <button onClick={downloadPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md transition-colors">
              {isDownloading ? 'Gerando...' : <><Download className="w-3 h-3" /> PDF</>}
            </button>
            
            <div className="w-px h-6 bg-zinc-700 mx-2" />

            <button onClick={playTTS} className={`p-1.5 rounded-md transition-colors ${isPlaying ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-700 text-zinc-400'}`} title="Play">
              <Play className={`w-4 h-4 ${isPlaying ? 'fill-current' : ''}`} />
            </button>
            <button onClick={stopTTS} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400" title="Stop"><Square className="w-4 h-4" /></button>
            <button onClick={() => {
              navigator.clipboard.writeText(report.content);
              if (addNotification) addNotification('Copiado para a área de transferência!', 'success');
            }} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400" title="Copiar"><Copy className="w-4 h-4" /></button>
            <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400">{isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto bg-black relative py-12 custom-scrollbar">
          {onPrev && (
            <button 
              onClick={onPrev}
              className="fixed left-8 top-1/2 -translate-y-1/2 z-50 p-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-full shadow-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all group"
              title="Anterior"
            >
              <ChevronLeft className="w-6 h-6 text-zinc-400 group-hover:text-white" />
            </button>
          )}
          
          {onNext && (
            <button 
              onClick={onNext}
              className="fixed right-8 top-1/2 -translate-y-1/2 z-50 p-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-full shadow-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all group"
              title="Próxima"
            >
              <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-white" />
            </button>
          )}

          <motion.div 
            key={report.id}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 0, opacity: 0 }}
            className="a4-page"
            ref={contentRef}
          >
            <div className="flex items-center justify-between mb-12 border-b-2 border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white flex items-center justify-center text-black font-serif font-bold text-xl">M</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white leading-tight">
                  Revista<br />Eletrônica
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Protocolo Mari v2.5</p>
                <p className="text-[10px] text-zinc-500">{new Date(report.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <h1 className="text-6xl font-serif font-black text-white leading-[1.05] tracking-tight mb-16 border-b-4 border-white pb-8">
              {report.title}
            </h1>
            
            {/* Featured Image Placeholder or First YouTube Video */}
            {report.youtubeVideos && report.youtubeVideos.length > 0 ? (
              <div className="aspect-video w-full rounded-none overflow-hidden border border-zinc-800 mb-12 shadow-none relative group bg-black">
                {activeVideo === report.youtubeVideos[0].id ? (
                  <iframe 
                    src={`https://www.youtube.com/embed/${report.youtubeVideos[0].id}?autoplay=1`} 
                    className="w-full h-full" 
                    allow="autoplay; encrypted-media" 
                    allowFullScreen 
                  />
                ) : (
                  <>
                    <img 
                      src={`https://img.youtube.com/vi/${report.youtubeVideos[0].id}/maxresdefault.jpg`} 
                      alt={report.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      onClick={() => setActiveVideo(report.youtubeVideos[0].id)}
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

            <MarkdownRenderer content={report.content} isMariReport={true} />
            
            {/* Sources Section */}
            {report.sources && report.sources.length > 0 && (
              <div className="mt-16 pt-8 border-t border-zinc-800">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-6">Fontes Consultadas</h3>
                <div className="grid grid-cols-1 gap-3">
                  {report.sources.map((source: any, idx: number) => (
                    <a 
                      key={idx}
                      href={typeof source === 'string' ? source : source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all group"
                    >
                      <span className="text-[10px] font-mono text-indigo-400 group-hover:text-indigo-300">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-[11px] text-zinc-300 truncate group-hover:text-white transition-colors">{typeof source === 'string' ? source : source.title || source}</span>
                      <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-20 pt-8 border-t border-zinc-100 text-center">
              <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em]">
                © {new Date().getFullYear()} JESUS I.A. 360° - Inteligência Artificial Autônoma
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
