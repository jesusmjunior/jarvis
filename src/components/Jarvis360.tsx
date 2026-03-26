import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Upload, Download, Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { storageService } from '../services/storageService';
import { syncService } from '../services/syncService';

interface Jarvis360Props {
  uid?: string;
  onSyncComplete?: () => void;
}

export default function Jarvis360({ uid, onSyncComplete }: Jarvis360Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'syncing'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');

  const handleSync = async () => {
    if (!uid) return;
    setStatus('syncing');
    setSyncMessage('Sincronizando com Supabase...');
    
    try {
      const result = await syncService.syncAll(uid);
      if (result.success) {
        setStatus('saved');
        setSyncMessage(result.message);
        onSyncComplete?.();
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setSyncMessage(result.message);
      }
    } catch (error) {
      setStatus('error');
      setSyncMessage('Erro inesperado na sincronização.');
    }
  };

  return (
    <div className="p-6 bg-zinc-950 border border-white/10 rounded-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <Database className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Jarvis 360</h2>
            <p className="text-xs text-zinc-500">Gerenciamento direto do banco de dados</p>
          </div>
        </div>

        {uid && (
          <button
            onClick={handleSync}
            disabled={status === 'syncing'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              status === 'syncing' 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
            {status === 'syncing' ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {status === 'syncing' || status === 'saved' || status === 'error' ? (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            status === 'syncing' ? 'bg-zinc-900 border-white/5 text-zinc-400' :
            status === 'saved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {status === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {status === 'saved' && <CheckCircle className="w-4 h-4" />}
            {status === 'error' && <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{syncMessage || 'Processando...'}</span>
          </div>
        ) : (
          <div className="p-4 bg-zinc-900 rounded-xl border border-white/5 text-center">
            <span className="text-sm font-bold text-zinc-500 italic">Pronto para sincronização</span>
          </div>
        )}
      </div>

      {status === 'error' && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Erro ao processar banco de dados.
        </div>
      )}
      
      <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 text-xs text-zinc-400 space-y-2">
        <p className="font-bold text-white">Instruções de Persistência:</p>
        <p>1. O banco de dados é salvo automaticamente no Google Drive se configurado.</p>
        <p>2. Use "Exportar DB" para guardar uma cópia local.</p>
        <p>3. Use "Importar DB" para restaurar um banco de dados de um arquivo .db.</p>
        <p>4. Se o Google Drive falhar, o app usa cache local.</p>
      </div>
    </div>
  );
}
