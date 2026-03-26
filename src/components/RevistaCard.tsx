import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Download, BookOpen, Maximize2, Copy, Trash2 } from 'lucide-react';
import { Report, archiveReport } from '../services/reportService';
import { GoogleGenAI, Modality } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { useApiKey } from '../contexts/ApiKeyContext';
import { secrets } from '../config/secrets';

interface RevistaCardProps {
  report: Report;
  isSelected: boolean;
  onToggleSelection: () => void;
  onRead: () => void;
  onDelete?: () => void;
}

export default function RevistaCard({ report, isSelected, onToggleSelection, onRead, onDelete }: RevistaCardProps) {
  const { activeKey: apiKey } = useApiKey();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const activeApiKey = apiKey || secrets.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey: activeApiKey });

  const playTTS = async () => {
    if (isPlaying) return;
    
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: report.content }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audioRef.current = audio;
        audio.play();
        setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
      }
    } catch (e) {
      console.error("Erro ao gerar áudio TTS:", e);
      alert("Erro ao gerar áudio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const pauseTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stopTTS = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(report.content);
    alert('Texto copiado!');
  };

  const exportPDF = async () => {
    if (!contentRef.current) return;
    
    // Temporarily make the content visible for html2canvas if it's hidden
    const originalStyle = contentRef.current.style.cssText;
    contentRef.current.style.display = 'block';
    contentRef.current.style.position = 'absolute';
    contentRef.current.style.left = '-9999px';
    contentRef.current.style.top = '0';
    contentRef.current.style.width = '800px'; // Fixed width for PDF generation
    contentRef.current.style.padding = '40px';
    contentRef.current.style.backgroundColor = '#ffffff';
    contentRef.current.style.color = '#000000';

    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      alert("Erro ao exportar PDF.");
    } finally {
      // Restore original style
      contentRef.current.style.cssText = originalStyle;
    }
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col h-full ${isSelected ? 'border-emerald-500 bg-zinc-800/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-white/10 bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-white/20'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-500 hover:border-zinc-400'}`}
            onClick={onToggleSelection}
          >
            {isSelected && <div className="w-2.5 h-2.5 bg-zinc-900 rounded-sm" />}
          </div>
          <span className="text-xs font-medium text-emerald-500/80 uppercase tracking-wider">Reportagem</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyText} className="p-1.5 text-zinc-400 hover:text-white transition-colors" title="Copiar Texto">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors" title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onRead} className="text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase bg-zinc-800/50 px-3 py-1.5 rounded-full" title="Expandir Reportagem">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRead} className="text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase bg-zinc-800/50 px-3 py-1.5 rounded-full">
            <BookOpen className="w-3.5 h-3.5" /> Ler
          </button>
        </div>
      </div>
      
      <h3 className="text-white font-bold text-lg mb-2 line-clamp-2 leading-tight">{report.title}</h3>
      <p className="text-zinc-400 text-sm mb-4 line-clamp-3 flex-grow">{report.content.substring(0, 150)}...</p>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
        <p className="text-zinc-500 text-xs font-mono">{new Date(report.createdAt).toLocaleDateString()}</p>
        
        <div className="flex items-center gap-1.5">
          {isPlaying ? (
            <button onClick={pauseTTS} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full hover:bg-emerald-500/30 transition-colors" title="Pausar">
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={playTTS} disabled={isGeneratingAudio} className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50" title="Ouvir">
              <Play className="w-4 h-4" />
            </button>
          )}
          
          <button onClick={stopTTS} disabled={!audioRef.current} className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50" title="Parar">
            <Square className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-white/10 mx-1" />
          
          <button onClick={exportPDF} className="p-2 bg-zinc-800 text-zinc-300 rounded-full hover:bg-zinc-700 hover:text-white transition-colors" title="Exportar PDF">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden content for PDF generation */}
      <div ref={contentRef} className="hidden">
        <div style={{ fontFamily: 'serif', padding: '40px', backgroundColor: 'white', color: 'black' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#10b981' }}>Revista Eletrônica</h1>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.2' }}>{report.title}</h2>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
            Publicado em: {new Date(report.createdAt).toLocaleDateString()}
          </p>
          <div style={{ fontSize: '16px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {report.content}
          </div>
          {report.sources && report.sources.length > 0 && (
            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', fontSize: '12px', color: '#666' }}>
              <strong>Fontes:</strong> {report.sources.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
