import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckSquare, Plus, Trash2, Edit2, X, Check, Loader2, 
  AlertCircle, RefreshCw, MoreVertical, Menu, Search,
  ChevronDown, ChevronUp, Star, Calendar, Clock
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated: string;
}

export default function GoogleTasksDashboard({ uid }: { uid: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const cached = localStorage.getItem(`tasks_data_${uid}`);
      if (cached) setTasks(JSON.parse(cached));

      const res = await apiFetch(`/api/db/google-sync/${uid}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.tasks) {
          setTasks(json.tasks);
          localStorage.setItem(`tasks_data_${uid}`, JSON.stringify(json.tasks));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [uid]);

  const syncTasks = async () => {
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/db/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, tools: ['tasks'] })
      });
      const json = await res.json();
      if (json.success && json.tasks) {
        setTasks(json.tasks);
        localStorage.setItem(`tasks_data_${uid}`, JSON.stringify(json.tasks));
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/tools/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle })
      });
      if (res.ok) {
        setNewTaskTitle('');
        await syncTasks();
      }
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
    } finally {
      setStatus('idle');
    }
  };

  const handleToggleComplete = async (task: Task) => {
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/tools/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          taskId: task.id, 
          status: task.status === 'completed' ? 'needsAction' : 'completed' 
        })
      });
      if (res.ok) await syncTasks();
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
    } finally {
      setStatus('idle');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Deseja excluir esta tarefa?')) return;
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/tools/tasks/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      });
      if (res.ok) await syncTasks();
    } catch (error) {
      console.error("Erro ao excluir tarefa:", error);
    } finally {
      setStatus('idle');
    }
  };

  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const pendingTasks = filteredTasks.filter(t => t.status !== 'completed');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-zinc-400 cursor-pointer" />
          <div className="flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-medium">Tarefas</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Pesquisar tarefas" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border border-transparent focus:border-white/10 rounded-md pl-10 pr-4 py-1.5 text-sm w-64 focus:outline-none"
            />
          </div>
          <button onClick={syncTasks} className="p-2 hover:bg-white/5 rounded-full text-zinc-400" title="Sincronizar">
            <RefreshCw className={`w-5 h-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 p-4 flex flex-col gap-6">
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-2 bg-blue-600/10 text-blue-400 rounded-lg text-sm font-medium">
              <Star className="w-4 h-4" />
              <span>Minha Lista</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Add Task Input */}
            <form onSubmit={handleCreateTask} className="relative group">
              <Plus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500" />
              <input 
                type="text" 
                placeholder="Adicionar uma tarefa" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm text-white focus:outline-none focus:border-blue-500/50 shadow-lg"
              />
            </form>

            {/* Pending Tasks */}
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-white/5 rounded-xl hover:bg-zinc-900 transition-colors group">
                  <button 
                    onClick={() => handleToggleComplete(task)}
                    className="w-5 h-5 border-2 border-zinc-600 rounded-full flex items-center justify-center hover:border-blue-500 transition-colors"
                  >
                    <Check className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{task.title}</p>
                    {task.due && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(task.due).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDeleteTask(task.id)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-4">
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Concluídas ({completedTasks.length})</span>
                </div>
                <div className="space-y-2">
                  {completedTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-4 p-4 bg-zinc-900/20 border border-white/5 rounded-xl opacity-60 group">
                      <button 
                        onClick={() => handleToggleComplete(task)}
                        className="w-5 h-5 bg-blue-600 border-2 border-blue-600 rounded-full flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </button>
                      <p className="flex-1 text-sm font-medium text-zinc-400 line-through">{task.title}</p>
                      <button onClick={() => handleDeleteTask(task.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
