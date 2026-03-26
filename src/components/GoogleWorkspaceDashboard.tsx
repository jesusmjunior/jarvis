import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, CheckSquare, FileText, RefreshCw, Loader2, AlertCircle, 
  CheckCircle, ExternalLink, Cloud, Plus, ChevronDown, ChevronUp, 
  LayoutGrid, List, Trash2, Edit2, Check, Search, Anchor, X 
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

export default function GoogleWorkspaceDashboard({ uid }: { uid: string }) {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'success' | 'error' | 'creating'>('idle');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<{ tasks: any[], events: any[], files: any[] }>({ tasks: [], events: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState({ tasks: false, calendar: false, drive: false });
  const [editingItem, setEditingItem] = useState<{ type: 'task' | 'event' | 'file', id: string, title: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'task' | 'event' | 'file', id: string } | null>(null);

  const toggleCol = (col: 'tasks' | 'calendar' | 'drive') => {
    setCollapsedCols(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const loadDataFromSupabase = async () => {
    try {
      setLoading(true);
      // Load from localStorage first for persistence
      const cached = localStorage.getItem(`workspace_data_${uid}`);
      if (cached) {
        setData(JSON.parse(cached));
        setLoading(false);
      }

      const res = await apiFetch(`/api/db/google-sync/${uid}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const newData = { tasks: json.tasks || [], events: json.events || [], files: json.files || [] };
          setData(newData);
          localStorage.setItem(`workspace_data_${uid}`, JSON.stringify(newData));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados do Supabase:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) {
      loadDataFromSupabase();
    }
  }, [uid]);

  const syncWithGoogle = async () => {
    setStatus('syncing');
    setMessage('Sincronizando com Google Workspace...');
    try {
      const res = await apiFetch('/api/db/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Falha na sincronização');

      const newData = { tasks: json.tasks || [], events: json.events || [], files: json.files || [] };
      setData(newData);
      localStorage.setItem(`workspace_data_${uid}`, JSON.stringify(newData));
      setStatus('success');
      setMessage('Sincronização concluída com sucesso!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Erro ao sincronizar. Verifique a conexão com o Google.');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setStatus('creating');
    try {
      const res = await apiFetch('/api/tools/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle })
      });
      
      if (!res.ok) throw new Error('Falha ao criar tarefa');
      
      setNewTaskTitle('');
      await syncWithGoogle();
    } catch (error: any) {
      setStatus('error');
      setMessage('Erro ao criar tarefa: ' + error.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    setStatus('creating');
    try {
      // Create a 1-hour event starting now
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const res = await apiFetch('/api/tools/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          summary: newEventTitle,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        })
      });
      
      if (!res.ok) throw new Error('Falha ao criar evento');
      
      setNewEventTitle('');
      await syncWithGoogle();
    } catch (error: any) {
      setStatus('error');
      setMessage('Erro ao criar evento: ' + error.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleDelete = async (type: 'task' | 'event' | 'file', id: string) => {
    setDeletingItem({ type, id });
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    
    const { type, id } = deletingItem;
    setDeletingItem(null);
    setStatus('syncing');
    try {
      const endpoint = type === 'task' ? '/api/tools/tasks/delete' : 
                       type === 'event' ? '/api/tools/calendar/delete' : 
                       '/api/tools/drive/delete';
      
      const body = type === 'task' ? { taskId: id } : 
                   type === 'event' ? { eventId: id } : 
                   { fileId: id };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Falha ao excluir item');
      
      await syncWithGoogle();
    } catch (error: any) {
      setStatus('error');
      setMessage('Erro ao excluir: ' + error.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setStatus('syncing');
    try {
      const endpoint = editingItem.type === 'task' ? '/api/tools/tasks/update' : 
                       editingItem.type === 'event' ? '/api/tools/calendar/update' : 
                       '/api/tools/drive/update';
      
      const body = editingItem.type === 'task' ? { taskId: editingItem.id, title: editingItem.title } : 
                   editingItem.type === 'event' ? { eventId: editingItem.id, summary: editingItem.title } : 
                   { fileId: editingItem.id, name: editingItem.title };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Falha ao atualizar item');
      
      setEditingItem(null);
      await syncWithGoogle();
    } catch (error: any) {
      setStatus('error');
      setMessage('Erro ao atualizar: ' + error.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/tools/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId, 
          status: currentStatus === 'completed' ? 'needsAction' : 'completed' 
        })
      });

      if (!res.ok) throw new Error('Falha ao atualizar tarefa');
      await syncWithGoogle();
    } catch (error: any) {
      setStatus('error');
      setMessage('Erro ao atualizar tarefa: ' + error.message);
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const filteredData = {
    tasks: data.tasks.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase())),
    events: data.events.filter(e => e.summary?.toLowerCase().includes(searchTerm.toLowerCase())),
    files: data.files.filter(f => f.name?.toLowerCase().includes(searchTerm.toLowerCase()))
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden transition-all duration-300">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Cloud className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Workspace Sync</h2>
              {!isHeaderCollapsed && <p className="text-[10px] text-zinc-500">Sincronização em tempo real</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <a 
              href="https://workspace.google.com/dashboard" 
              target="_blank" 
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-white/5 transition-all"
              title="Acessar dados reais"
            >
              <Anchor className="w-4 h-4" />
            </a>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                syncWithGoogle();
              }}
              disabled={status === 'syncing' || status === 'creating'}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 disabled:opacity-50 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border border-indigo-500/20"
            >
              <RefreshCw className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
            {isHeaderCollapsed ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronUp className="w-4 h-4 text-zinc-500" />}
          </div>
        </div>

        {!isHeaderCollapsed && (
          <div className="px-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar em tarefas, eventos e arquivos..."
                className="w-full bg-zinc-900/50 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/30 placeholder:text-zinc-600"
              />
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Editar {editingItem.type === 'task' ? 'Tarefa' : editingItem.type === 'event' ? 'Evento' : 'Arquivo'}</h3>
              <button onClick={() => setEditingItem(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5 ml-1">Título</label>
                <input 
                  type="text"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-widest rounded-xl border border-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={status === 'syncing' || !editingItem.title.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {status === 'syncing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-widest">Confirmar Exclusão</h3>
            </div>
            
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Tem certeza que deseja excluir este {deletingItem.type === 'task' ? 'tarefa' : deletingItem.type === 'event' ? 'evento' : 'arquivo'}? Esta ação não pode ser desfeita no Google Workspace.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingItem(null)}
                className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-widest rounded-xl border border-white/5 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-500 transition-all"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {message}
        </div>
      )}
      
      {status === 'success' && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
          <CheckCircle className="w-3 h-3" />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tasks Column */}
        <div className={`bg-zinc-950 border border-white/10 rounded-3xl p-4 flex flex-col transition-all duration-300 ${collapsedCols.tasks ? 'h-auto' : 'h-[450px]'}`}>
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer group"
            onClick={() => toggleCol('tasks')}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Tasks</h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">{filteredData.tasks.length}</span>
            </div>
            {collapsedCols.tasks ? <ChevronDown className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />}
          </div>
          
          {!collapsedCols.tasks && (
            <>
              <form onSubmit={handleCreateTask} className="mb-4 flex gap-2">
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Nova tarefa..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
                  disabled={status === 'creating'}
                />
                <button 
                  type="submit"
                  disabled={!newTaskTitle.trim() || status === 'creating'}
                  className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                >
                  {status === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredData.tasks.length === 0 ? (
                  <p className="text-[10px] text-zinc-600 text-center py-8 uppercase tracking-widest">Vazio</p>
                ) : (
                  filteredData.tasks.map((task: any) => (
                    <div key={task.id} className="p-2.5 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${task.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                            {task.title}
                          </p>
                          {task.due && <p className="text-[9px] text-emerald-500/70 mt-1 uppercase tracking-tighter">Vence: {new Date(task.due).toLocaleDateString()}</p>}
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleToggleComplete(task.id, task.status)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                            title={task.status === 'completed' ? 'Marcar como pendente' : 'Marcar como concluído'}
                          >
                            <Check className="w-3 h-3" />
                            {task.status === 'completed' ? 'Realizado' : 'Concluir'}
                          </button>
                          <button 
                            onClick={() => setEditingItem({ type: 'task', id: task.id, title: task.title })}
                            className="p-1.5 bg-zinc-800 text-zinc-500 hover:text-blue-400 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDelete('task', task.id)}
                            className="p-1.5 bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Calendar Column */}
        <div className={`bg-zinc-950 border border-white/10 rounded-3xl p-4 flex flex-col transition-all duration-300 ${collapsedCols.calendar ? 'h-auto' : 'h-[450px]'}`}>
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer group"
            onClick={() => toggleCol('calendar')}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Calendar</h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">{filteredData.events.length}</span>
            </div>
            {collapsedCols.calendar ? <ChevronDown className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />}
          </div>

          {!collapsedCols.calendar && (
            <>
              <form onSubmit={handleCreateEvent} className="mb-4 flex gap-2">
                <input 
                  type="text" 
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Novo evento..."
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 placeholder:text-zinc-600"
                  disabled={status === 'creating'}
                />
                <button 
                  type="submit"
                  disabled={!newEventTitle.trim() || status === 'creating'}
                  className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                >
                  {status === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredData.events.length === 0 ? (
                  <p className="text-[10px] text-zinc-600 text-center py-8 uppercase tracking-widest">Vazio</p>
                ) : (
                  filteredData.events.map((event: any) => (
                    <div key={event.id} className="p-2.5 bg-zinc-900/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-200 font-medium truncate">{event.summary || 'Sem título'}</p>
                          <p className="text-[9px] text-blue-500/70 mt-1 uppercase tracking-tighter">
                            {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString() : 
                             event.start?.date ? new Date(event.start.date).toLocaleDateString() : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingItem({ type: 'event', id: event.id, title: event.summary })}
                            className="p-1 bg-zinc-800 text-zinc-500 hover:text-blue-400 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDelete('event', event.id)}
                            className="p-1 bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Drive Column */}
        <div className={`bg-zinc-950 border border-white/10 rounded-3xl p-4 flex flex-col transition-all duration-300 ${collapsedCols.drive ? 'h-auto' : 'h-[450px]'}`}>
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer group"
            onClick={() => toggleCol('drive')}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Drive</h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">{filteredData.files.length}</span>
            </div>
            {collapsedCols.drive ? <ChevronDown className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />}
          </div>

          {!collapsedCols.drive && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredData.files.length === 0 ? (
                <p className="text-[10px] text-zinc-600 text-center py-8 uppercase tracking-widest">Vazio</p>
              ) : (
                filteredData.files.map((file: any) => (
                  <div 
                    key={file.id} 
                    className="p-2.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-xl border border-white/5 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-200 font-medium line-clamp-1">{file.name}</p>
                        <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-tighter">Modificado: {new Date(file.modifiedTime).toLocaleDateString()}</p>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a 
                          href={file.webViewLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1 bg-zinc-800 text-zinc-500 hover:text-amber-400 rounded-lg transition-colors"
                          title="Abrir no Drive"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button 
                          onClick={() => setEditingItem({ type: 'file', id: file.id, title: file.name })}
                          className="p-1 bg-zinc-800 text-zinc-500 hover:text-blue-400 rounded-lg transition-colors"
                          title="Renomear"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleDelete('file', file.id)}
                          className="p-1 bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

}
