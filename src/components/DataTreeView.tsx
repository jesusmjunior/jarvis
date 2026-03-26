import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  MessageSquare, 
  Search, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Database, 
  Zap, 
  Activity, 
  LayoutGrid, 
  Filter, 
  Trash2, 
  ExternalLink, 
  Youtube, 
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Globe
} from 'lucide-react';
import { dataTreeService, DataTreeNode } from '../services/dataTreeService';
import { syncService } from '../services/syncService';
import { toast } from 'react-toastify';

interface DataTreeViewProps {
  uid: string;
  onClose: () => void;
}

export default function DataTreeView({ uid, onClose }: DataTreeViewProps) {
  const [tree, setTree] = useState<DataTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'session' | 'search'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    loadTree();
    setPendingCount(syncService.getPendingCount());
    checkDbStatus();
  }, [uid]);

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db/health');
      const data = await res.json();
      if (data.status === 'connected') setDbStatus('connected');
      else setDbStatus('error');
    } catch {
      setDbStatus('error');
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncService.sync();
    setIsSyncing(false);
    
    if (result.success) {
      toast.success(result.message);
      setPendingCount(0);
      loadTree();
    } else {
      toast.error(result.message);
    }
  };

  const loadTree = async () => {
    setIsLoading(true);
    const builtTree = await dataTreeService.buildTree(uid);
    setTree(builtTree);
    // Expand first date by default
    if (builtTree.length > 0) {
      setExpandedNodes(new Set([builtTree[0].id]));
    }
    setIsLoading(false);
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'date': return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'session': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case 'search': return <Search className="w-4 h-4 text-blue-500" />;
      case 'note': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'video': return <Youtube className="w-4 h-4 text-red-500" />;
      case 'file': return <FileText className="w-4 h-4 text-amber-500" />;
      case 'source': return <Globe className="w-4 h-4 text-zinc-400" />;
      default: return <Activity className="w-4 h-4 text-zinc-500" />;
    }
  };

  const renderNode = (node: DataTreeNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    // Filter children if needed
    const filteredChildren = node.children?.filter(child => 
      filter === 'all' || child.type === filter
    ) || [];

    if (node.type === 'date' && filter !== 'all' && filteredChildren.length === 0) {
      return null;
    }

    return (
      <div key={node.id} className="space-y-1">
        <div 
          onClick={() => hasChildren ? toggleNode(node.id) : null}
          className={`
            flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group
            ${depth === 0 ? 'bg-zinc-900/50 border border-white/5' : 'hover:bg-white/5'}
            ${isExpanded && depth === 0 ? 'border-amber-500/20 bg-amber-500/5' : ''}
          `}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-3 flex-1">
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />
            ) : (
              <div className="w-4" />
            )}
            {getIcon(node.type)}
            <span className={`text-sm font-medium ${depth === 0 ? 'text-white' : 'text-zinc-400'}`}>
              {node.label}
            </span>
            {node.type === 'search' && node.data?.type === 'youtube' && (
              <Youtube className="w-3 h-3 text-red-500" />
            )}
            {node.type === 'search' && node.data?.type === 'drive' && (
              <HardDrive className="w-3 h-3 text-emerald-500" />
            )}
          </div>
          
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
              {new Date(node.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {node.type !== 'date' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const url = node.type === 'file' ? node.data?.public_url : (node.data?.link || node.data?.webViewLink);
                  if (url) window.open(url, '_blank');
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {filteredChildren.map(child => renderNode(child, depth + 1))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
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
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Activity className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Data Tree</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Interações em Tempo Real</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors group"
        >
          <X className="w-6 h-6 text-zinc-500 group-hover:text-white" />
        </button>
      </div>

      {/* Filters */}
      <div className="p-6 bg-zinc-900/30 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'Tudo', icon: LayoutGrid },
            { id: 'session', label: 'Chats', icon: MessageSquare },
            { id: 'search', label: 'Buscas', icon: Search },
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id as any)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
                ${filter === btn.id ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 text-zinc-500 hover:text-white border border-white/5'}
              `}
            >
              <btn.icon className="w-3 h-3" />
              {btn.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all
            ${pendingCount > 0 ? 'bg-emerald-500 text-black animate-pulse' : 'bg-zinc-900 text-zinc-500 border border-white/5'}
            disabled:opacity-50 disabled:animate-none
          `}
        >
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {isSyncing ? 'Sincronizando...' : `Sincronizar (${pendingCount})`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-50">
            <Activity className="w-12 h-12 animate-pulse text-amber-500" />
            <p className="text-sm font-medium">Mapeando árvore de dados...</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
            <Database className="w-20 h-20" />
            <div>
              <p className="text-lg font-bold">Árvore vazia</p>
              <p className="text-sm">Inicie interações para ver os dados ramificados.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {tree.map(node => renderNode(node))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-6 bg-zinc-900/50 border-t border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              dbStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
              dbStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Supabase: {dbStatus === 'connected' ? 'Conectado' : dbStatus === 'checking' ? 'Verificando...' : 'Erro de Tabelas'}
            </span>
          </div>
          {dbStatus === 'error' && (
            <button 
              onClick={checkDbStatus}
              className="text-[10px] font-bold text-amber-500 hover:underline"
            >
              Tentar Novamente
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-zinc-500">
            <Zap className="w-4 h-4 text-amber-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              Sincronização Ativa // Memória RAM
            </p>
          </div>
          <button 
            onClick={loadTree}
            className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors"
          >
            Atualizar Árvore
          </button>
        </div>
      </div>
    </motion.div>
  );
}
