import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Play, Pause, Square, Loader2, Download, Table, BookOpen } from 'lucide-react';
import { protocoloMariResearch, Report } from '../services/reportService';
import { GoogleGenAI, Modality } from "@google/genai";
import RevistaEletronica from './RevistaEletronica';

import { useApiKey } from '../contexts/ApiKeyContext';
import { secrets } from '../config/secrets';

export default function JarvisReportGenerator({ onReportGenerated }: { onReportGenerated?: (report: Report) => void }) {
  const { activeKey: apiKey } = useApiKey();
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [progress, setProgress] = useState(0);
  const [showRevista, setShowRevista] = useState(false);
  const [hashnodeToken, setHashnodeToken] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateReport = async () => {
    setStatus('processing');
    setProgress(10);
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90));
    }, 1000);

    try {
      const newReport = await protocoloMariResearch(query, undefined, apiKey || "");
      setReport(newReport);
      setStatus('success');
      setProgress(100);
      if (onReportGenerated) onReportGenerated(newReport);
    } catch (e) {
      setStatus('idle');
      setProgress(0);
      alert('Erro ao gerar relatório.');
    } finally {
      clearInterval(interval);
    }
  };

  const publishToHashnode = async () => {
    if (!report || !hashnodeToken) return;
    setIsPublishing(true);
    try {
      const res = await fetch('/api/tools/hashnode/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: report.title, 
          content: report.content, 
          token: hashnodeToken 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Publicado com sucesso! URL: ${data.post.url}`);
      } else {
        alert(`Erro ao publicar: ${data.error}`);
      }
    } catch (e) {
      alert('Erro ao conectar com Hashnode.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-950 border border-white/10 rounded-3xl space-y-6">
      <h2 className="text-xl font-bold text-white">Gerador de Relatórios (Protocolo Mari)</h2>
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ex: melhores séries 2024-2026"
        className="w-full p-3 bg-zinc-900 rounded-xl border border-white/5 text-white"
      />
      <button onClick={generateReport} className="p-3 bg-indigo-500 rounded-xl text-white font-bold w-full flex items-center justify-center gap-2">
        {status === 'processing' ? <Loader2 className="animate-spin" /> : 'Gerar Relatório'}
        {status === 'processing' && <span>{progress}%</span>}
      </button>

      {report && (
        <button onClick={() => setShowRevista(true)} className="flex items-center gap-2 p-3 bg-zinc-800 rounded-xl text-white font-bold">
          <BookOpen className="w-4 h-4" />
          Abrir na Revista Eletrônica
        </button>
      )}

      <AnimatePresence>
        {showRevista && report && (
          <RevistaEletronica report={report} onClose={() => setShowRevista(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
