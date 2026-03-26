import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Table, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { youtubeService } from '../services/youtubeService';
import { YouTubeVideo } from '../services/youtubeService';

export default function GoogleProductivity({ uid }: { uid: string }) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const exportToSheets = async () => {
    setStatus('processing');
    setMessage('Exportando para Sheets...');
    try {
      const videos = await youtubeService.getYouTubeVideos(uid);
      if (videos.length === 0) throw new Error('Nenhum vídeo salvo para exportar.');

      // 1. Create a new Sheet
      const createRes = await fetch('/api/tools/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Jarvis 360 - Vídeos Salvos' })
      });
      const { spreadsheet } = await createRes.json();

      // 2. Prepare data
      const values = [['Título', 'Canal', 'Link', 'Data Publicação']];
      videos.forEach(v => values.push([v.title, v.channelTitle, v.link, new Date(v.timestamp).toLocaleDateString()]));

      // 3. Update Sheet
      await fetch('/api/tools/sheets/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          spreadsheetId: spreadsheet.spreadsheetId, 
          range: 'A1', 
          values 
        })
      });

      setStatus('success');
      setMessage('Vídeos exportados para Sheets com sucesso!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message);
    }
  };

  const generateReport = async () => {
    setStatus('processing');
    setMessage('Gerando relatório no Docs...');
    try {
      const videos = await youtubeService.getYouTubeVideos(uid);
      if (videos.length === 0) throw new Error('Nenhum vídeo salvo para o relatório.');

      const content = `Relatório de Vídeos Salvos - Jarvis 360\n\n${videos.map(v => `- ${v.title} (${v.channelTitle}): ${v.link}`).join('\n')}`;
      
      await fetch('/api/tools/drive/create_doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Relatório de Vídeos Jarvis 360', content })
      });

      setStatus('success');
      setMessage('Relatório gerado no Docs com sucesso!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message);
    }
  };

  return (
    <div className="p-6 bg-zinc-950 border border-white/10 rounded-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/10 rounded-2xl">
          <Table className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Produtividade Google</h2>
          <p className="text-xs text-zinc-500">Docs e Sheets</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={exportToSheets}
          className="flex items-center justify-center gap-2 p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-white/5 transition-all"
        >
          <Table className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-bold text-white">Exportar para Sheets</span>
        </button>
        
        <button 
          onClick={generateReport}
          className="flex items-center justify-center gap-2 p-4 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-white/5 transition-all"
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-bold text-white">Gerar Relatório (Docs)</span>
        </button>
      </div>

      {status === 'processing' && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {message}
        </div>
      )}
      
      {status === 'success' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {message}
        </div>
      )}
    </div>
  );
}
