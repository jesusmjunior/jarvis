import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, Plus, Search, X, Copy, Trash2, Play, Pause, 
  Edit3, Wand2, Check, Loader2, Save, Square, FileText, BookOpen, Youtube, ChevronDown, ChevronUp
} from 'lucide-react';
import { transcribeAudio, generateTTS, getGeminiResponse } from '../services/geminiChat';
import { errorService, ErrorCategory } from '../services/errorService';

import { Card } from '../types';

interface UnifiedCardNotesProps {
  user: any;
  apiKey: string;
  onClose: () => void;
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
}

const COLORS = ['#ffffff', '#ef4444', '#3b82f6', '#eab308']; // White, Red, Blue, Yellow

export default function UnifiedCardNotes({ user, apiKey, onClose, cards, setCards }: UnifiedCardNotesProps) {
  const [search, setSearch] = useState('');
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const saveCards = (newCards: Card[]) => {
    setCards(newCards);
    localStorage.setItem(`cards_${user?.uid}`, JSON.stringify(newCards));
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    audioChunks.current = [];
    mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const text = await transcribeAudio(base64Audio, apiKey);
        if (text) {
          const newCard: Card = {
            id: Date.now().toString(),
            type: 'note',
            title: 'Nova Nota de Voz',
            content: text,
            timestamp: Date.now(),
            color: COLORS[0],
            isCollapsed: false,
            isPinned: false
          };
          setEditingCard(newCard);
        }
      };
    };
    mediaRecorder.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const handleAiAction = async (action: 'correct' | 'transform') => {
    if (!editingCard) return;
    setIsAiProcessing(true);
    try {
      const prompt = action === 'correct' 
        ? `Corrija gramática e pontuação do seguinte texto, mantendo o sentido original: "${editingCard.content}"`
        : `Você é um especialista em estruturação de dados e lógica de programação. Transforme o texto do usuário em um conjunto de comandos organizados, lógicos, imperativos e estruturados.
        Regras:
        1. Elimine toda a prolixidade, redundância e linguagem lúdica ou informal.
        2. Organize o conteúdo em uma sequência de passos lógicos, assertivos e diretos.
        3. Foque em ações específicas, funções e resultados esperados.
        4. O texto final deve ser esquemático, direto e pronto para ser executado como um conjunto de instruções.
        5. NÃO use pseudocódigo. Use linguagem natural imperativa (ex: 'Defina X', 'Execute Y', 'Valide Z').
        Texto a ser transformado: "${editingCard.content}"`;
      const response = await getGeminiResponse(prompt, apiKey, "Assistente de edição.");
      if (response.text) setEditingCard({ ...editingCard, content: response.text });
    } finally {
      setIsAiProcessing(false);
    }
  };

  const playTTS = async (text: string, id: string) => {
    if (isPlaying === id) { audioPlayer.current?.pause(); setIsPlaying(null); return; }
    setIsPlaying(id);
    const base64Audio = await generateTTS(text, apiKey);
    if (base64Audio) {
      audioPlayer.current!.src = `data:audio/mp3;base64,${base64Audio}`;
      audioPlayer.current!.play();
      audioPlayer.current!.onended = () => setIsPlaying(null);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col p-6">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Cards & Notas</h2>
        <button onClick={onClose}><X className="text-zinc-500" /></button>
      </div>
      <div className="flex gap-4 mb-6">
        <input className="flex-1 bg-zinc-900 p-3 rounded-xl text-white" placeholder="Buscar..." onChange={(e) => setSearch(e.target.value)} />
        <button onClick={() => setEditingCard({ id: Date.now().toString(), type: 'note', title: 'Nova Nota', content: '', timestamp: Date.now(), color: COLORS[0], isCollapsed: false, isPinned: false })} className="bg-blue-600 p-3 rounded-xl text-white"><Plus /></button>
        <button onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-xl ${isRecording ? 'bg-red-600' : 'bg-emerald-600'}`}><Mic /></button>
      </div>

      <div className="grid grid-cols-4 gap-4 overflow-y-auto">
        {cards.filter(c => c.content.includes(search)).map(card => (
          <div key={card.id} className="bg-zinc-900 p-4 rounded-xl border-2" style={{ borderColor: card.color }}>
            <div className="flex justify-between mb-2">
              <h3 className="font-bold text-white">{card.title}</h3>
              <div className="flex gap-2">
                <button onClick={() => setCards(prev => prev.map(c => c.id === card.id ? {...c, isPinned: !c.isPinned} : c))}>{card.isPinned ? '📌' : '📍'}</button>
                <button onClick={() => setCards(prev => prev.map(c => c.id === card.id ? {...c, isArchived: !c.isArchived} : c))}>{card.isArchived ? '📂' : '📁'}</button>
                <button onClick={() => setEditingCard(card)}><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => saveCards(cards.filter(c => c.id !== card.id))}><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
            <p className="text-zinc-400 text-sm">{card.content}</p>
          </div>
        ))}
      </div>

      {editingCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-8">
          <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-lg">
            <textarea className="w-full h-64 bg-zinc-950 text-white p-4 rounded-xl" value={editingCard.content} onChange={(e) => setEditingCard({...editingCard, content: e.target.value})} />
            <div className="flex gap-2 mt-4">
              {COLORS.map(c => <button key={c} className="w-8 h-8 rounded-full" style={{backgroundColor: c}} onClick={() => setEditingCard({...editingCard, color: c})} />)}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => handleAiAction('correct')} className="bg-zinc-800 p-2 rounded-xl text-white">Corrigir</button>
              <button onClick={() => handleAiAction('transform')} className="bg-blue-600 p-2 rounded-xl text-white">Transformar</button>
              <button onClick={() => { saveCards([...cards.filter(c => c.id !== editingCard.id), editingCard]); setEditingCard(null); }} className="bg-emerald-600 p-2 rounded-xl text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}
      <audio ref={audioPlayer} className="hidden" />
    </motion.div>
  );
}
