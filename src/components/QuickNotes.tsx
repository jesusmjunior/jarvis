import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Plus, Search, X, Copy, Trash2, Play, Pause, 
  FastForward, Edit3, Wand2, Check, Loader2, Save, 
  RotateCcw, Volume2, Sparkles, Square
} from 'lucide-react';
import { transcribeAudio, generateTTS, getGeminiResponse } from '../services/geminiChat';
import { errorService, ErrorCategory } from '../services/errorService';

interface Note {
  id: string;
  content: string;
  timestamp: number;
  color: string;
  uid: string;
}

interface QuickNotesProps {
  user: any;
  apiKey: string;
  onClose: () => void;
}

const COLORS = [
  '#3f3f31', // Dark Olive/Yellow (from design)
  '#1e293b', // Slate
  '#064e3b', // Emerald
  '#4c1d95', // Violet
  '#701a75', // Fuchsia
];

export default function QuickNotes({ user, apiKey, onClose }: QuickNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load notes from Supabase via backend API
    const loadNotes = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/db/metadata/notes_${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          const loadedNotes = JSON.parse(data.value) || [];
          setNotes(loadedNotes.sort((a: any, b: any) => b.timestamp - a.timestamp));
        }
      } catch (error) {
        errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar notas.');
      }
    };
    loadNotes();
  }, [user]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      errorService.log(error, ErrorCategory.USER_INTERACTION, 'Erro ao acessar microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const text = await transcribeAudio(base64Audio, apiKey);
        
        if (text) {
          const newNote = {
            id: Date.now().toString(),
            content: text,
            timestamp: Date.now(),
            color: COLORS[0],
            uid: user.uid
          };
          // Open edit modal instead of saving immediately
          setEditingNote(newNote);
        }
      };
    } catch (error) {
      errorService.log(error, ErrorCategory.API, 'Erro na transcrição do áudio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const createNewNote = async () => {
    try {
      const newNote = {
        id: Date.now().toString(),
        content: '',
        timestamp: Date.now(),
        color: COLORS[0],
        uid: user.uid
      };
      setEditingNote(newNote);
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao criar nota.');
    }
  };

  const saveNote = async () => {
    if (!editingNote) return;
    try {
      const updatedNotes = notes.map(n => n.id === editingNote.id ? editingNote : n);
      if (!notes.find(n => n.id === editingNote.id)) {
        updatedNotes.unshift(editingNote);
      }
      setNotes(updatedNotes);
      
      // Save to Supabase via backend API
      await fetch('/api/db/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `notes_${user.uid}`, value: updatedNotes })
      });
      
      setEditingNote(null);
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao salvar nota.');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const updatedNotes = notes.filter(n => n.id !== id);
      setNotes(updatedNotes);
      
      // Save to Supabase via backend API
      await fetch('/api/db/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `notes_${user.uid}`, value: updatedNotes })
      });
      
      if (editingNote?.id === id) setEditingNote(null);
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao excluir nota.');
    }
  };

  const copyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    // Could add a small toast here
  };

  const playTTS = async (text: string, id: string) => {
    if (isPlaying === id) {
      audioPlayer.current?.pause();
      setIsPlaying(null);
      return;
    }

    try {
      setIsPlaying(id);
      const base64Audio = await generateTTS(text, apiKey);
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        if (audioPlayer.current) {
          audioPlayer.current.src = audioUrl;
          audioPlayer.current.playbackRate = playbackRate;
          audioPlayer.current.play();
          audioPlayer.current.onended = () => setIsPlaying(null);
        }
      }
    } catch (error) {
      setIsPlaying(null);
      errorService.log(error, ErrorCategory.API, 'Erro ao gerar áudio da nota.');
    }
  };

  const handleAiAction = async (action: 'correct' | 'transform') => {
    if (!editingNote) return;
    setIsAiProcessing(true);
    try {
      const prompt = action === 'correct' 
        ? `Corrija gramática e pontuação desta nota, mantendo o sentido original: "${editingNote.content}"`
        : `Transforme esta nota em um texto mais profissional e estruturado: "${editingNote.content}"`;
      
      const response = await getGeminiResponse(prompt, apiKey, "Você é um assistente especializado em edição de texto.");
      if (response.text) {
        setEditingNote({ ...editingNote, content: response.text });
      }
    } catch (error) {
      errorService.log(error, ErrorCategory.API, 'Erro no processamento IA da nota.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const filteredNotes = notes.filter(n => 
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Edit3 className="w-6 h-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Notas de Voz</h1>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-6 h-6 text-zinc-500" />
        </button>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input 
            type="text"
            placeholder="Buscar notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>
        <button 
          onClick={createNewNote}
          className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-5 h-5" />
          Nova Nota
        </button>
        <div className="flex items-center gap-4">
          {isTranscribing && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-widest"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Processando Áudio...
            </motion.div>
          )}
          <button 
            onClick={toggleRecording}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-600 animate-pulse scale-110' : 'bg-emerald-600 hover:bg-emerald-500'
            } shadow-lg ${isRecording ? 'shadow-red-500/40' : 'shadow-emerald-500/20'}`}
            title={isRecording ? "Parar Gravação" : "Iniciar Gravação"}
          >
            {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setEditingNote(note)}
                className="group relative bg-zinc-900/50 border-2 rounded-3xl p-6 cursor-pointer hover:bg-zinc-900 transition-all h-64 flex flex-col"
                style={{ borderColor: note.color }}
              >
                <p className="text-zinc-300 text-sm line-clamp-6 flex-1">
                  {note.content || <span className="italic opacity-30">Nota vazia...</span>}
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); playTTS(note.content, note.id); }}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors"
                    >
                      {isPlaying === note.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); copyNote(note.content); }}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-4 right-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  {new Date(note.timestamp).toLocaleDateString()}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-6 h-6 text-emerald-500" />
                  Editar Nota
                </h2>
                <button 
                  onClick={() => setEditingNote(null)}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <textarea 
                value={editingNote.content}
                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                placeholder="Escreva sua nota aqui..."
                className="w-full h-64 bg-zinc-950 border border-white/10 rounded-3xl p-6 text-white text-lg focus:outline-none focus:border-emerald-500 transition-all resize-none custom-scrollbar"
              />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mr-2">Cor:</span>
                  {COLORS.map(color => (
                    <button 
                      key={color}
                      onClick={() => setEditingNote({ ...editingNote, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        editingNote.color === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAiAction('correct')}
                    disabled={isAiProcessing || !editingNote.content}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Corrigir
                  </button>
                  <button 
                    onClick={() => handleAiAction('transform')}
                    disabled={isAiProcessing || !editingNote.content}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isAiProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Transformar p/ IA
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-white/5">
                  <button 
                    onClick={() => playTTS(editingNote.content, editingNote.id)}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    {isPlaying === editingNote.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <div className="flex items-center gap-1 px-2 border-l border-white/10">
                    <button 
                      onClick={() => setPlaybackRate(r => r === 1 ? 1.5 : r === 1.5 ? 2 : 1)}
                      className="text-[10px] font-bold text-zinc-500 hover:text-emerald-500 transition-colors w-8"
                    >
                      {playbackRate}x
                    </button>
                    <FastForward className="w-3 h-3 text-zinc-600" />
                  </div>
                </div>
                
                <div className="flex-1" />

                <button 
                  onClick={() => setEditingNote(null)}
                  className="px-6 py-3 text-zinc-500 hover:text-white font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveNote}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioPlayer} className="hidden" />
    </motion.div>
  );
}
