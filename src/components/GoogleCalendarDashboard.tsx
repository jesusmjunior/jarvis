import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Search, Settings, HelpCircle, Menu, MoreVertical, 
  Trash2, Edit2, X, Check, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  status?: string;
}

export default function GoogleCalendarDashboard({ uid }: { uid: string }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ summary: '', description: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00' });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const cached = localStorage.getItem(`calendar_events_${uid}`);
      if (cached) setEvents(JSON.parse(cached));

      const res = await apiFetch(`/api/db/google-sync/${uid}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.events) {
          setEvents(json.events);
          localStorage.setItem(`calendar_events_${uid}`, JSON.stringify(json.events));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar eventos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [uid]);

  const syncEvents = async () => {
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/db/google-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, tools: ['calendar'] })
      });
      const json = await res.json();
      if (json.success && json.events) {
        setEvents(json.events);
        localStorage.setItem(`calendar_events_${uid}`, JSON.stringify(json.events));
      }
    } catch (error) {
      console.error("Erro ao sincronizar:", error);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('syncing');
    try {
      const startDateTime = new Date(`${newEvent.date}T${newEvent.startTime}:00`).toISOString();
      const endDateTime = new Date(`${newEvent.date}T${newEvent.endTime}:00`).toISOString();

      const res = await apiFetch('/api/tools/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          summary: newEvent.summary,
          description: newEvent.description,
          startTime: startDateTime,
          endTime: endDateTime
        })
      });

      if (res.ok) {
        setShowEventModal(false);
        setNewEvent({ summary: '', description: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00' });
        await syncEvents();
      }
    } catch (error) {
      console.error("Erro ao criar evento:", error);
    } finally {
      setStatus('idle');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Deseja excluir este evento?')) return;
    setStatus('syncing');
    try {
      const res = await apiFetch('/api/tools/calendar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId })
      });
      if (res.ok) {
        setSelectedEvent(null);
        await syncEvents();
      }
    } catch (error) {
      console.error("Erro ao excluir evento:", error);
    } finally {
      setStatus('idle');
    }
  };

  // Helper to get days in month
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayOfMonth = days[0].getDay();
  const blanks = Array(firstDayOfMonth).fill(null);

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-zinc-400 cursor-pointer" />
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-medium">Agenda</span>
          </div>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="ml-4 px-4 py-1.5 border border-white/10 rounded-md text-sm hover:bg-white/5 transition-colors"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1.5 hover:bg-white/5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1.5 hover:bg-white/5 rounded-full"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <span className="text-xl ml-2">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Pesquisar" 
              className="bg-zinc-900 border border-transparent focus:border-white/10 rounded-md pl-10 pr-4 py-1.5 text-sm w-64 focus:outline-none"
            />
          </div>
          <button onClick={syncEvents} className="p-2 hover:bg-white/5 rounded-full text-zinc-400" title="Sincronizar">
            <RefreshCw className={`w-5 h-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
          <Settings className="w-5 h-5 text-zinc-400 cursor-pointer" />
          <select 
            value={view} 
            onChange={(e) => setView(e.target.value as any)}
            className="bg-zinc-900 border border-white/10 rounded-md px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="month">Mês</option>
            <option value="week">Semana</option>
            <option value="day">Dia</option>
          </select>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 p-4 flex flex-col gap-6">
          <button 
            onClick={() => setShowEventModal(true)}
            className="flex items-center gap-3 px-4 py-3 bg-white text-zinc-900 rounded-full shadow-lg hover:shadow-xl transition-all font-medium"
          >
            <Plus className="w-6 h-6" />
            <span>Criar</span>
          </button>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Meus Calendários</h4>
            <div className="flex items-center gap-3 px-2">
              <input type="checkbox" checked readOnly className="accent-blue-500" />
              <span className="text-sm">Principal</span>
            </div>
          </div>
        </aside>

        {/* Main Calendar Grid */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-7 border-b border-white/10">
            {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold text-zinc-500 tracking-widest border-r border-white/10 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[120px]">
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="border-r border-b border-white/10 bg-zinc-900/20"></div>
            ))}
            {days.map(day => {
              const isToday = day.toDateString() === new Date().toDateString();
              const dayEvents = events.filter(e => {
                const eventDate = e.start.dateTime ? new Date(e.start.dateTime) : e.start.date ? new Date(e.start.date) : null;
                return eventDate && eventDate.toDateString() === day.toDateString();
              });

              return (
                <div key={day.toISOString()} className="border-r border-b border-white/10 p-1 flex flex-col gap-1 hover:bg-white/5 transition-colors group">
                  <div className="flex justify-center">
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
                    {dayEvents.map(event => (
                      <div 
                        key={event.id} 
                        onClick={() => setSelectedEvent(event)}
                        className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] rounded truncate cursor-pointer hover:bg-blue-600/30 transition-colors"
                      >
                        {event.summary}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium text-white">{selectedEvent.summary}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDeleteEvent(selectedEvent.id)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-red-400 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4 text-sm text-zinc-400">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-5 h-5" />
                <span>
                  {selectedEvent.start.dateTime ? new Date(selectedEvent.start.dateTime).toLocaleString() : 
                   selectedEvent.start.date ? new Date(selectedEvent.start.date).toLocaleDateString() : ''}
                </span>
              </div>
              {selectedEvent.description && (
                <div className="flex items-start gap-3">
                  <Menu className="w-5 h-5 mt-0.5" />
                  <p className="whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium text-white">Novo Evento</h3>
              <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <input 
                type="text" 
                placeholder="Adicionar título" 
                value={newEvent.summary}
                onChange={(e) => setNewEvent({...newEvent, summary: e.target.value})}
                className="w-full bg-transparent border-b border-white/10 px-0 py-2 text-xl text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
                autoFocus
                required
              />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Data</label>
                  <input 
                    type="date" 
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Início</label>
                    <input 
                      type="time" 
                      value={newEvent.startTime}
                      onChange={(e) => setNewEvent({...newEvent, startTime: e.target.value})}
                      className="w-full bg-zinc-800 border border-white/5 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Fim</label>
                    <input 
                      type="time" 
                      value={newEvent.endTime}
                      onChange={(e) => setNewEvent({...newEvent, endTime: e.target.value})}
                      className="w-full bg-zinc-800 border border-white/5 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <textarea 
                placeholder="Adicionar descrição" 
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
              />

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowEventModal(false)}
                  className="px-6 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={status === 'syncing'}
                  className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-500 transition-all disabled:opacity-50"
                >
                  Salvar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
