import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveServerMessage } from "@google/genai";
import { Mic, MicOff, Video, VideoOff, X, Volume2, VolumeX, Search, Loader2, ShieldAlert, RefreshCw, Eye, Zap, Brain, ChevronDown, MessageSquareText, ChevronUp, Maximize2, Minimize2, Archive, Trash2, Minus, ShieldCheck, ExternalLink, FileText, Download, HardDrive, Youtube, CheckSquare, Calendar, BookOpen, ChevronLeft, ChevronRight, Image, Bot, Power, Layout, Copy, Clock, Activity, Camera, Lock, Unlock, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WhiteboardNote } from './WhiteboardNote';
import { TTSPlayer } from './TTSPlayer';
import { Card } from '../types';
import { GeminiLiveService, LiveConnectionStatus } from '../services/geminiLive';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MapComponent } from './MapComponent';
import { MariReportCard } from './MariReportCard';
import { MariPhotoGallery } from './MariPhotoGallery';
import RevistaEletronica from './RevistaEletronica';
import { searchService } from '../services/searchService';
import { syncService } from '../services/syncService';
import { protocoloMariResearch, archiveReport } from '../services/reportService';
import { apiFetch } from '../services/apiClient';
import { whiteboardManager } from '../utils/WhiteboardManager';

interface GeminiLiveProps {
  apiKey: string;
  onClose: () => void;
  voiceName: string;
  sessionId: string | null;
  onChangeVoice?: (voice: string) => void;
  isLocalStorageEnabled?: boolean;
  uid: string;
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  onApproveNote: (id: string) => void;
  backgroundTasks: Array<{id: string, title: string, progress: number}>;
  setBackgroundTasks: React.Dispatch<React.SetStateAction<Array<{id: string, title: string, progress: number}>>>;
  setMaps: React.Dispatch<React.SetStateAction<any[]>>;
  setPhotos: React.Dispatch<React.SetStateAction<any[]>>;
  addTask: (id: string, title: string) => void;
  updateTaskProgress: (id: string, progress: number) => void;
  removeTask: (id: string) => void;
  setActiveReport: React.Dispatch<React.SetStateAction<any | null>>;
  setShowRevista: React.Dispatch<React.SetStateAction<boolean>>;
}

type QuickMode = 'drive' | 'youtube' | 'tasks' | 'calendar' | 'revista' | 'photos' | 'docs' | 'sheets' | 'vision' | 'image' | null;

const GeminiLive: React.FC<GeminiLiveProps> = ({ 
  apiKey, 
  onClose, 
  voiceName, 
  sessionId, 
  onChangeVoice, 
  isLocalStorageEnabled = false, 
  uid, 
  cards, 
  setCards, 
  onApproveNote,
  backgroundTasks,
  setBackgroundTasks,
  setMaps,
  setPhotos,
  addTask: addGlobalTask,
  updateTaskProgress: updateGlobalTask,
  removeTask: removeGlobalTask,
  setActiveReport,
  setShowRevista
}) => {
  const [status, setStatus] = useState<LiveConnectionStatus>(LiveConnectionStatus.IDLE);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isConversationModeActive, setIsConversationModeActive] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [activeQuickMode, setActiveQuickMode] = useState<QuickMode>(null);

  const [transcription, setTranscription] = useState<string>('');
  const [showTranscription, setShowTranscription] = useState(false);
  const [agentState, setAgentState] = useState<'listening' | 'thinking' | 'speaking'>('listening');
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [searchProgress, setSearchProgress] = useState<{ active: boolean; label: string; progress: number }>({
    active: false,
    label: '',
    progress: 0
  });
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isPlayingNote, setIsPlayingNote] = useState<string | null>(null);
  const [maximizedCardId, setMaximizedCardId] = useState<string | null>(null);
  const [collapsedCardIds, setCollapsedCardIds] = useState<Set<string>>(new Set());
  const [showMagazine, setShowMagazine] = useState<any | null>(null);
  const [showDetailedTasks, setShowDetailedTasks] = useState(false);
  const [isBottomBarCollapsed, setIsBottomBarCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Changed default to false
  const [taskQueue, setTaskQueue] = useState<{ id: string; label: string; progress: number; status: 'pending' | 'processing' | 'completed' | 'error' }[]>([]);
  const [liveInsights, setLiveInsights] = useState<{ id: string; label: string; type: 'search' | 'action'; query: string }[]>([]);
  const [isProcessingInsights, setIsProcessingInsights] = useState(false);
  const lastProcessedTextRef = useRef('');

  const liveServiceRef = useRef<GeminiLiveService | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef<number>(0);
  const currentSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isAudioOnRef = useRef(isAudioOn);
  const isPausedRef = useRef(isPaused);
  const currentTurnTextRef = useRef<string>('');

  useEffect(() => {
    isAudioOnRef.current = isAudioOn;
  }, [isAudioOn]);

  const addNotification = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const stopAudio = useCallback(() => {
    audioQueueRef.current = [];
    currentSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
    });
    currentSourcesRef.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
    setAgentState('listening');
  }, []);

  const playAudioQueue = useCallback(async () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0 || isPausedRef.current) {
      isPlayingRef.current = false;
      return;
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    isPlayingRef.current = true;
    
    // Schedule ahead
    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      const floatData = new Float32Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        floatData[i] = chunk[i] / 0x7FFF;
      }
      
      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.copyToChannel(floatData, 0);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      
      const now = audioContextRef.current.currentTime;
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.02; // Reduced from 0.05 to 0.02 for faster response
      }
      
      currentSourcesRef.current.push(source);
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
      
      source.onended = () => {
        currentSourcesRef.current = currentSourcesRef.current.filter(s => s !== source);
        if (audioQueueRef.current.length === 0 && audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) {
          setAgentState('listening');
          isPlayingRef.current = false;
        }
      };
    }
  }, []);

  const onNext = useCallback(() => {
    const list = activeTab === 'active' ? searchResults : savedCards;
    const index = list.findIndex(r => r.id === showMagazine.id);
    if (index !== -1 && index < list.length - 1) {
      setShowMagazine(list[index + 1]);
    }
  }, [activeTab, searchResults, savedCards, showMagazine]);

  const onPrev = useCallback(() => {
    const list = activeTab === 'active' ? searchResults : savedCards;
    const index = list.findIndex(r => r.id === showMagazine.id);
    if (index > 0) {
      setShowMagazine(list[index - 1]);
    }
  }, [activeTab, searchResults, savedCards, showMagazine]);

  useEffect(() => {
    isPausedRef.current = isPaused;
    if (!isPaused && audioQueueRef.current.length > 0 && !isPlayingRef.current) {
      playAudioQueue();
    }
  }, [isPaused, playAudioQueue]);

  useEffect(() => {
    const loadSavedCards = async () => {
      if (uid) {
        const mode: 'local' | 'memory' = isLocalStorageEnabled ? 'local' : 'memory';
        const history = await searchService.getHistory(uid, 50, 0, mode);
        const cards = history.map(entry => ({
          id: entry.id,
          type: entry.type === 'web' && entry.results?.[0]?.isReport ? 'report' : (entry.type === 'web' && entry.query.startsWith('Nota') ? 'note' : entry.type),
          title: entry.query,
          content: entry.results?.[0]?.text || '',
          results: entry.results,
          timestamp: entry.timestamp,
          query: entry.query,
          lat: entry.type === 'map' ? entry.results?.[0]?.lat : undefined,
          lng: entry.type === 'map' ? entry.results?.[0]?.lng : undefined,
          markers: entry.type === 'map' ? entry.results?.[0]?.markers : undefined,
          route: entry.type === 'map' ? entry.results?.[0]?.route : undefined
        }));
        setSavedCards(cards);
      }
    };
    loadSavedCards();
  }, []);

  const handleSaveCard = async (card: any) => {
    const newCard = {
      ...card,
      timestamp: Date.now(),
      title: card.title || card.query || (card.type === 'note' ? 'Nota de Áudio' : 'Pesquisa'),
    };

    try {
      const docId = await searchService.saveSearch(uid, {
        query: newCard.title,
        type: card.type === 'note' ? 'web' : card.type,
        results: card.type === 'note' ? [{ text: card.content }] : card.results,
        summary: card.type === 'note' ? `Nota arquivada: ${newCard.title}` : `Resultado de ${card.type} para "${card.query}"`,
        sessionId: sessionId || undefined
      }, isLocalStorageEnabled ? 'local' : 'memory');

      if (docId) {
        setSavedCards(prev => [{ ...newCard, id: docId }, ...prev]);
        addNotification('Card salvo com sucesso!', 'success');
      }
    } catch (err: any) {
      addNotification('Erro ao salvar card', 'error');
    }
  };

  const handleSaveVideo = async (video: any, query: string) => {
    try {
      const docId = await searchService.saveSearch(uid, {
        query: video.title,
        type: 'youtube',
        results: [video],
        summary: `Vídeo salvo da busca: "${query}"`,
        sessionId: sessionId || undefined
      }, isLocalStorageEnabled ? 'local' : 'memory');

      if (docId) {
        setSavedCards(prev => [{
          id: docId,
          type: 'youtube',
          title: video.title,
          results: [video],
          timestamp: Date.now(),
          query: query
        }, ...prev]);
        addNotification('Vídeo salvo individualmente!', 'success');
      }
    } catch (err: any) {
      addNotification('Erro ao salvar vídeo', 'error');
    }
  };

  const handleDeleteCard = async (id: string, isSaved: boolean = false) => {
    if (isSaved) {
      const mode: 'local' | 'memory' = isLocalStorageEnabled ? 'local' : 'memory';
      const success = await searchService.deleteSearch(id, uid, mode);
      if (success) {
        setSavedCards(prev => prev.filter(c => c.id !== id));
        addNotification('Card removido do arquivo', 'info');
      } else {
        addNotification('Erro ao remover card', 'error');
      }
    } else {
      setSearchResults(prev => prev.filter(c => c.id !== id));
      addNotification('Card descartado', 'info');
    }
  };

  const handleEditCard = (id: string, newContent: string, isSaved: boolean = false) => {
    if (isSaved) {
      setSavedCards(prev => prev.map(c => c.id === id ? { ...c, content: newContent, results: c.type === 'web' ? [{ title: c.title, uri: c.results[0]?.uri, text: newContent }] : c.results } : c));
    } else {
      setSearchResults(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c));
    }
    setEditingCardId(null);
    addNotification('Card atualizado', 'success');
  };

  const startEditing = (card: any) => {
    setEditingCardId(card.id);
    setEditValue(card.content || card.query || '');
  };

  const handleCopyCard = (content: string) => {
    navigator.clipboard.writeText(content);
    addNotification('Conteúdo copiado!', 'success');
  };

  const handleInsightClick = async (insight: { id: string; label: string; type: 'search' | 'action'; query: string }) => {
    if (!liveServiceRef.current || status !== LiveConnectionStatus.ACTIVE) return;
    
    try {
      if (insight.type === 'search') {
        await liveServiceRef.current.sendText(`JESUS I.A., pesquise profundamente sobre: ${insight.query}`);
        addNotification(`Pesquisa de aninhamento iniciada: ${insight.label}`, 'info');
      } else {
        await liveServiceRef.current.sendText(insight.query);
        addNotification(`Ação disparada: ${insight.label}`, 'info');
      }
      setLiveInsights(prev => prev.filter(i => i.id !== insight.id));
    } catch (e) {
      console.error("Erro ao disparar insight:", e);
    }
  };

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      addNotification("Transcrição copiada!", "success");
    }
  };

  const handleCorrect = async () => {
    if (!transcription || !apiKey) return;
    
    setIsProcessingInsights(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Corrija a grafia, remova onomatopéias e redundâncias, e sintetize o seguinte texto em tópicos (bullets) para facilitar o entendimento de uma IA:
        
        Texto: ${transcription}`,
      });
      
      const correctedText = response.text;
      if (correctedText) {
        setTranscription(correctedText);
        addNotification("Texto corrigido e sintetizado!", "success");
      }
    } catch (e) {
      console.error("Erro ao corrigir texto:", e);
      addNotification("Erro ao corrigir texto.", "error");
    } finally {
      setIsProcessingInsights(false);
    }
  };

  useEffect(() => {
    const processInsights = async () => {
      if (!apiKey || !apiKey.startsWith("AIza") || !transcription || transcription.length < 40 || isProcessingInsights || status !== LiveConnectionStatus.ACTIVE) return;
      
      const currentText = transcription;
      if (currentText === lastProcessedTextRef.current) return;
      
      // Only process if we have significant new text
      const diffLength = currentText.length - lastProcessedTextRef.current.length;
      if (diffLength < 50 && lastProcessedTextRef.current !== '') return;

      setIsProcessingInsights(true);
      try {
        const { GoogleGenAI, Type } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Analise este trecho de conversa em tempo real e extraia 2 ou 3 "insights" curtos (máximo 3 palavras cada). 
          Cada insight deve ser um termo de busca relevante ou uma ação sugerida baseada no contexto.
          Retorne em JSON: [{"label": "termo", "type": "search|action", "query": "comando ou termo de busca"}]
          
          Conversa: ${currentText.slice(-800)}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['search', 'action'] },
                  query: { type: Type.STRING }
                },
                required: ['label', 'type', 'query']
              }
            }
          }
        });

        const newInsights = JSON.parse(response.text || '[]');
        if (newInsights.length > 0) {
          setLiveInsights(prev => {
            const withIds = newInsights.map((i: any) => ({ ...i, id: Math.random().toString(36).substring(7) }));
            // Filter duplicates by label
            const combined = [...withIds, ...prev];
            const unique = combined.filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);
            return unique.slice(0, 4); // Keep last 4
          });
        }
        lastProcessedTextRef.current = currentText;
      } catch (e) {
        console.error("Erro ao processar insights:", e);
      } finally {
        setIsProcessingInsights(false);
      }
    };

    const timer = setTimeout(processInsights, 4000);
    return () => clearTimeout(timer);
  }, [transcription, apiKey, status, isProcessingInsights]);

  // Listen for whiteboard messages
  useEffect(() => {
    const unsubscribe = whiteboardManager.subscribe((data) => {
      if (data?.type === 'WHITEBOARD_CONNECTED') {
        addNotification("Lousa Criativa conectada com sucesso", "success");
      } else if (data?.type === 'CARD_REMOVED') {
        console.log('Card removed from whiteboard:', data.id);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleQuickMode = async (mode: QuickMode) => {
    if (activeQuickMode === mode) {
      setActiveQuickMode(null);
      return;
    }
    setActiveQuickMode(mode);
    
    if (liveServiceRef.current && status === LiveConnectionStatus.ACTIVE) {
      let prompt = "";
      
      switch (mode) {
        case 'drive':
          prompt = `[MODO DRIVE ATIVADO] O usuário ativou o modo Google Drive. Se o usuário acabou de pedir uma pesquisa, execute-a agora. Caso contrário, pergunte o que ele deseja pesquisar no Drive. Exiba os resultados em formato de lista.`;
          break;
        case 'youtube':
          prompt = `[MODO YOUTUBE ATIVADO] O usuário ativou o modo YouTube. Se o usuário acabou de pedir uma pesquisa, execute-a agora. Caso contrário, pergunte o que ele deseja pesquisar no YouTube. Exiba os resultados em formato de lista.`;
          break;
        case 'tasks':
          prompt = `[MODO TAREFAS ATIVADO] O usuário ativou o modo Tarefas. Se o usuário acabou de pedir para adicionar uma tarefa, adicione-a agora. Caso contrário, pergunte qual tarefa ele deseja adicionar.`;
          break;
        case 'calendar':
          prompt = `[MODO CALENDÁRIO ATIVADO] O usuário ativou o modo Calendário. Se o usuário acabou de pedir para adicionar um evento, adicione-o agora. Caso contrário, pergunte qual evento ele deseja adicionar.`;
          break;
        case 'revista':
          prompt = `[MODO REVISTA ATIVADO] O usuário ativou o modo Revista Eletrônica. Se o usuário acabou de pedir uma reportagem, gere-a agora seguindo o PROTOCOLO MARI e apresentando em formato de revista eletrônica elegante. Caso contrário, pergunte sobre qual tema ele deseja a reportagem.`;
          break;
        case 'docs':
          prompt = `[MODO DOCUMENTOS ATIVADO] O usuário ativou o modo Google Docs. Se o usuário acabou de pedir para criar ou editar um documento, faça-o agora. Caso contrário, pergunte o que ele deseja fazer no Google Docs.`;
          break;
        case 'sheets':
          prompt = `[MODO PLANILHAS ATIVADO] O usuário ativou o modo Google Sheets. Se o usuário acabou de pedir para criar ou editar uma planilha, faça-o agora. Caso contrário, pergunte o que ele deseja fazer no Google Sheets.`;
          break;
        case 'photos':
          prompt = `[MODO FOTOS ATIVADO] O usuário ativou o modo Google Fotos. Se o usuário acabou de pedir uma pesquisa de fotos, execute-a agora usando a ferramenta 'photos_search'. Caso contrário, pergunte o que ele deseja pesquisar no Google Fotos. Exiba os resultados em formato de galeria.`;
          break;
        case 'vision':
          prompt = `[MODO VISÃO ATIVADO] O usuário ativou o modo Cloud Vision. Se o usuário enviou uma imagem ou link de imagem, analise-a agora usando 'vision_analyze'. Caso contrário, peça para ele enviar uma imagem ou link para análise.`;
          break;
        case 'image':
          prompt = `[MODO IMAGEM ATIVADO] O usuário ativou o modo Geração de Imagem. Se o usuário acabou de pedir uma imagem, gere-a agora usando a ferramenta 'generate_image' (Pollinations AI). Caso contrário, pergunte o que ele deseja que você gere.`;
          break;
      }
      
      try {
        await liveServiceRef.current.sendText(prompt);
        addNotification(`Modo ${mode} ativado e instrução enviada`, 'success');
        setTimeout(() => setActiveQuickMode(null), 3000); // Reset after a short delay
      } catch (e) {
        console.error("Erro ao enviar comando de modo:", e);
      }
    }
  };

  const playNote = async (content: string, id: string) => {
    if (isPlayingNote === id) {
      setIsPlayingNote(null);
      stopAudio();
      return;
    }

    try {
      setIsPlayingNote(id);
      addNotification('Iniciando leitura da nota...', 'info');
      
      const { GoogleGenAI, Modality } = await import("@google/genai");
      if (!apiKey || !apiKey.startsWith("AIza")) {
        addNotification("API Key inválida ou ausente.", "error");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Leia esta nota com clareza: ${content}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName as any },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio && audioContextRef.current) {
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const pcmData = new Int16Array(bytes.buffer);
        audioQueueRef.current.push(pcmData);
        setAgentState('speaking');
        playAudioQueue();
      }
    } catch (err: any) {
      addNotification(`Erro ao ler nota: ${err.message}`, 'error');
    } finally {
      setIsPlayingNote(null);
    }
  };

  const handleArchiveNote = () => {
    if (!transcription) return;
    handleSaveCard({
      type: 'note',
      content: transcription,
      title: `Nota - ${new Date().toLocaleTimeString()}`,
    });
    setTranscription('');
  };

  const toggleCollapse = (id: string) => {
    setCollapsedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMaximize = (id: string) => {
    setMaximizedCardId(prev => prev === id ? null : id);
  };

  const addTask = (label: string) => {
    if (taskQueue.some(t => t.label === label)) {
      console.warn('Tarefa já existe na fila:', label);
      return null;
    }
    const id = Math.random().toString(36).substring(7);
    const newTask = { id, label, progress: 0, status: 'pending' as const };
    setTaskQueue(prev => [...prev, newTask]);
    addGlobalTask(id, label);
    return id;
  };

  const updateTask = (id: string, updates: Partial<{ progress: number; status: 'pending' | 'processing' | 'completed' | 'error' }>) => {
    setTaskQueue(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task));
    if (updates.progress !== undefined) {
      updateGlobalTask(id, updates.progress);
    }
  };

  const removeTask = (id: string) => {
    setTimeout(() => {
      setTaskQueue(prev => prev.filter(task => task.id !== id));
      removeGlobalTask(id);
    }, 3000); // Keep for 3 seconds after completion
  };

  const handleArchiveCard = async (search: any) => {
    await handleSaveCard(search);
    handleDeleteCard(search.id);
  };

  const SearchProgressHalo = ({ progress, label }: { progress: number; label: string }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="flex flex-col items-center justify-center p-8 bg-zinc-900/90 backdrop-blur-3xl border border-indigo-500/40 rounded-[2.5rem] shadow-[0_0_80px_-12px_rgba(99,102,241,0.5)] mb-8 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-zinc-800"
            />
            <motion.circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="text-indigo-500"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white tabular-nums">{progress}%</span>
            <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Status</span>
          </div>
          
          {/* Pulsing core */}
          <div className="absolute w-16 h-16 bg-indigo-500/10 rounded-full blur-xl animate-pulse" />
        </div>
        
        <div className="mt-6 text-center space-y-2">
          <h4 className="text-sm font-bold text-white uppercase tracking-[0.2em]">{label}</h4>
          <p className="text-[10px] text-zinc-400 font-medium italic">Processando dados em tempo real...</p>
        </div>
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [-20, 120],
                x: [Math.random() * 300, Math.random() * 300],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
              className="absolute w-1 h-1 bg-indigo-400 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    );
  };

  const setupAudio = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: isVideoOn ? { facingMode } : false 
      });
      
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      // Reduced buffer size from 8192 to 2048 for lower latency (~128ms at 16kHz)
      const processor = audioContextRef.current.createScriptProcessor(2048, 1, 1);
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      processor.onaudioprocess = (e) => {
        if (!isMicOn || isPausedRef.current || !liveServiceRef.current) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        
        // Optimized conversion
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // More efficient base64 conversion for small buffers
        const uint8 = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);
        
        liveServiceRef.current.sendAudio(base64Data);
      };
    } catch (err: any) {
      setError(`Erro ao configurar áudio: ${err.message}`);
    }
  }, [isMicOn, isVideoOn, facingMode]);

  useEffect(() => {
    if (!isLiveActive) {
      setStatus(LiveConnectionStatus.IDLE);
      return;
    }
    
    // If already connected, check if mode changed
    if (liveServiceRef.current && liveServiceRef.current.getStatus() === LiveConnectionStatus.ACTIVE) {
        // If we need to change mode, we must disconnect and reconnect
        // But we'll handle this via a separate effect or manual trigger to avoid loops
        return;
    }

    if (!apiKey || !apiKey.startsWith("AIza")) {
      addNotification("API Key inválida ou ausente.", "error");
      return;
    }
    const service = new GeminiLiveService(apiKey);
    liveServiceRef.current = service;

    const handleToolCall = async (toolCall: any) => {
      if (!toolCall.functionCalls) return;
      
      const responses = [];
      for (const call of toolCall.functionCalls) {
        const { name, args, id } = call;
        let result = null;
        
        const taskId = addTask(`Executando: ${name}...`);
        updateTask(taskId, { status: 'processing', progress: 30 });
        
        try {
          setSearchProgress({ active: true, label: `Executando: ${name}...`, progress: 30 });
          
          const storedToken = localStorage.getItem('jarvis_auth_token');
          const headers: any = { 'Content-Type': 'application/json' };
          if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

          let endpoint = '';
          let body = args;

          switch (name) {
            case 'youtube_search':
              endpoint = '/api/tools/youtube/search';
              break;
            case 'drive_search':
              endpoint = '/api/tools/drive/search';
              break;
            case 'drive_create_folder':
              endpoint = '/api/tools/drive/create_folder';
              break;
            case 'drive_create_doc':
              endpoint = '/api/tools/drive/create_doc';
              break;
            case 'drive_move_file':
              endpoint = '/api/tools/drive/move_file';
              break;
            case 'drive_upload_file':
              endpoint = '/api/tools/drive/upload';
              break;
            case 'drive_download_file':
              endpoint = '/api/tools/drive/download';
              break;
            case 'drive_share_file':
              endpoint = '/api/tools/drive/share';
              break;
            case 'drive_list_labels':
              endpoint = '/api/tools/drive/labels/list';
              break;
            case 'drive_apply_label':
              endpoint = '/api/tools/drive/labels/apply';
              break;
            case 'calendar_list':
              endpoint = '/api/tools/calendar/list';
              break;
            case 'calendar_create':
              endpoint = '/api/tools/calendar/create';
              break;
            case 'tasks_list':
              endpoint = '/api/tools/tasks/list';
              break;
            case 'tasks_create':
              endpoint = '/api/tools/tasks/create';
              break;
            case 'gmail_send':
              endpoint = '/api/tools/gmail/send';
              break;
            case 'photos_search':
              endpoint = '/api/tools/photos/search';
              break;
            case 'photos_delete':
              endpoint = '/api/tools/photos/delete';
              break;
            case 'create_note':
              const newCard: Card = { 
                id: Math.random().toString(36).substring(7), 
                type: 'note', 
                title: args.title, 
                content: args.content, 
                timestamp: Date.now(), 
                color: '#ffffff', 
                isCollapsed: false, 
                isPinned: false,
                isArchived: false,
                sessionId: sessionId || 'default'
              };
              setCards(prev => [...prev, newCard]);
              
              // Sync to Supabase
              syncService.addToQueue('cards', { ...newCard, uid });
              apiFetch('/api/db/cards', {
                method: 'POST',
                body: JSON.stringify({ ...newCard, uid })
              }).catch(err => console.warn('Falha no salvamento imediato da nota:', err));

              result = { success: true, message: `Nota criada com sucesso: ${args.title}. Conteúdo: ${args.content}. OBRIGATÓRIO: Apresente a nota ao usuário e aguarde autorização explícita antes de realizar qualquer pesquisa (mari_research, youtube_search, etc.).`, noteId: newCard.id };
              addNotification(`Nota criada: ${args.title}`, 'success');
              break;
            case 'update_note':
              setCards(prev => prev.map(c => {
                if (c.id === args.id) {
                  const updated = { ...c, content: args.content };
                  syncService.addToQueue('cards', { ...updated, uid });
                  apiFetch('/api/db/cards', {
                    method: 'POST',
                    body: JSON.stringify({ ...updated, uid })
                  }).catch(err => console.warn('Falha na atualização imediata da nota:', err));
                  return updated;
                }
                return c;
              }));
              result = { success: true, message: "Nota atualizada com sucesso." };
              addNotification(`Nota atualizada: ${args.id}`, 'success');
              break;
            case 'delete_note':
              setCards(prev => prev.filter(c => c.id !== args.id));
              apiFetch(`/api/db/cards/${args.id}`, { method: 'DELETE' })
                .catch(err => console.warn('Falha na exclusão imediata da nota:', err));
              result = { success: true, message: "Nota apagada com sucesso." };
              addNotification(`Nota apagada: ${args.id}`, 'success');
              break;
            case 'archive_note':
              setCards(prev => prev.map(c => {
                if (c.id === args.id) {
                  const updated = { ...c, isArchived: true };
                  syncService.addToQueue('cards', { ...updated, uid });
                  apiFetch('/api/db/cards', {
                    method: 'POST',
                    body: JSON.stringify({ ...updated, uid })
                  }).catch(err => console.warn('Falha no arquivamento imediato da nota:', err));
                  return updated;
                }
                return c;
              }));
              result = { success: true, message: "Nota arquivada com sucesso." };
              addNotification(`Nota arquivada: ${args.id}`, 'success');
              break;
            case 'vision_analyze':
              endpoint = '/api/tools/vision/analyze';
              break;
            case 'generate_image':
              const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(args.prompt)}?width=${args.width || 1024}&height=${args.height || 1024}&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
              const imageCardId = Math.random().toString(36).substring(7);
              const imageCard = { 
                id: imageCardId, 
                type: 'note' as const, 
                query: args.prompt, 
                content: `### Imagem Gerada (Pollinations AI)\n\n![${args.prompt}](${imageUrl})\n\n**Prompt:** ${args.prompt}`,
                timestamp: Date.now() 
              };
              setSearchResults(prev => [imageCard, ...prev]);
              result = { success: true, url: imageUrl, message: "Imagem gerada com sucesso via Pollinations AI." };
              addNotification(`Imagem gerada: ${args.prompt}`, 'success');
              break;
            case 'mari_research':
                if (!apiKey || !apiKey.startsWith("AIza")) {
                  addNotification("API Key inválida ou ausente.", "error");
                  return;
                }
                const isFast = args.mode === 'fast';
                const taskId = addTask(isFast ? `Gerando Nota: ${args.query}` : `Pesquisa Profunda: ${args.query}`);
                if (taskId) updateTask(taskId, { status: 'processing', progress: 10 });
                
                setSearchProgress({ active: true, label: isFast ? 'Gerando nota informativa...' : 'Iniciando Protocolo MARI...', progress: 15 });
                
                try {
                  const report = await protocoloMariResearch(args.query, (p) => {
                    setSearchProgress(prev => ({ ...prev, progress: Math.floor(p * 100) }));
                    if (taskId) updateTask(taskId, { progress: Math.floor(p * 100) });
                  }, apiKey, isFast ? 'fast' : 'deep');
                  
                  // Save to Revista Eletrônica (archive)
                  await archiveReport(report);
                  
                  const reportCardId = Math.random().toString(36).substring(7);
                  const reportCard = { 
                    id: reportCardId, 
                    type: isFast ? 'note' : 'report', 
                    query: args.query, 
                    content: report.content, 
                    results: report.sources.map(s => ({ uri: s, title: s })),
                    youtubeVideos: report.youtubeVideos || [],
                    timestamp: Date.now() 
                  };
                  setSearchResults(prev => [reportCard, ...prev]);
                  if (!isFast) {
                    setActiveReport(report);
                    setShowRevista(true);
                  }
                  
                  if (taskId) {
                    updateTask(taskId, { status: 'completed', progress: 100 });
                    removeTask(taskId);
                  }
                  setSearchProgress({ active: false, label: '', progress: 0 });
                  
                  addNotification(`Protocolo MARI: ${isFast ? 'Nota editorial' : 'Reportagem'} sobre "${args.query}" gerada e salva`, 'success');
                  result = { success: true, message: `${isFast ? 'Nota editorial' : 'Reportagem'} gerada e salva com sucesso.` };
                } catch (err) {
                  if (taskId) updateTask(taskId, { status: 'error' });
                  setSearchProgress({ active: false, label: '', progress: 0 });
                  throw err;
                }
                break;
            case 'map_search':
              // Map search is handled directly on the client for display
              result = { success: true, ...args };
              const mapCardId = Math.random().toString(36).substring(7);
              const mapCard = { 
                id: mapCardId, 
                type: 'map' as const, 
                query: args.locationName, 
                lat: args.lat, 
                lng: args.lng, 
                markers: args.markers, 
                route: args.route,
                timestamp: Date.now() 
              };
              setSearchResults(prev => [mapCard, ...prev]);
              setMaps(prev => {
                const updated = [mapCard, ...prev];
                syncService.addToQueue('maps', { ...mapCard, uid });
                apiFetch('/api/db/maps', {
                  method: 'POST',
                  body: JSON.stringify({ uid, maps: updated })
                }).catch(err => console.warn('Falha no salvamento do mapa:', err));
                return updated;
              });
              addNotification(`Mapa: ${args.locationName} exibido`, 'success');
              
              // Save to history
              if (apiKey) {
                searchService.saveSearch(uid, {
                  query: args.locationName,
                  type: 'map',
                  results: [{ lat: args.lat, lng: args.lng, markers: args.markers, route: args.route }],
                  summary: `Visualização de mapa para "${args.locationName}".`,
                  sessionId: sessionId || undefined
                }, isLocalStorageEnabled ? 'local' : 'memory');
              }
              break;
            default:
              throw new Error(`Ferramenta ${name} não suportada no Modo Live.`);
          }

          if (name !== 'map_search' && endpoint) {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
              credentials: 'include'
            });
            
            const data = await res.json();
            
            if (data.success) {
              result = data;
              const cardId = Math.random().toString(36).substring(7);
              if (name === 'youtube_search') {
                const youtubeCard = { id: cardId, type: 'youtube' as const, query: args.query, results: data.videos, timestamp: Date.now() };
                setSearchResults(prev => [youtubeCard, ...prev]);
                addNotification(`YouTube: ${data.videos.length} vídeos encontrados`, 'success');
                if (apiKey) {
                  searchService.saveSearch(uid, {
                    query: args.query,
                    type: 'youtube',
                    results: data.videos,
                    summary: `Busca no YouTube por "${args.query}" retornou ${data.videos.length} vídeos.`,
                    sessionId: sessionId || undefined
                  }, isLocalStorageEnabled ? 'local' : 'memory');
                }
              } else if (name === 'drive_search') {
                setSearchResults(prev => [{ id: cardId, type: 'drive', query: args.query, results: data.files, timestamp: Date.now() }, ...prev]);
                addNotification(`Drive: ${data.files.length} arquivos encontrados`, 'success');
                if (apiKey) {
                  searchService.saveSearch(uid, {
                    query: args.query,
                    type: 'drive',
                    results: data.files,
                    summary: `Busca no Google Drive por "${args.query}" retornou ${data.files.length} arquivos.`,
                    sessionId: sessionId || undefined
                  }, isLocalStorageEnabled ? 'local' : 'memory');
                }
              } else if (name === 'calendar_list') {
                addNotification(`Agenda: ${data.events?.length || 0} compromissos encontrados`, 'success');
              } else if (name === 'calendar_create') {
                addNotification(`Agenda: Compromisso criado com sucesso`, 'success');
              } else if (name === 'tasks_list') {
                addNotification(`Tarefas: ${data.tasks?.length || 0} tarefas encontradas`, 'success');
              } else if (name === 'tasks_create') {
                addNotification(`Tarefas: Tarefa criada com sucesso`, 'success');
              } else if (name === 'gmail_send') {
                addNotification(`Gmail: E-mail enviado com sucesso`, 'success');
              } else if (name === 'photos_search') {
                const photoCard = { id: cardId, type: 'photos' as const, query: args.query || args.category || 'Busca de fotos', results: data.photos, timestamp: Date.now() };
                setSearchResults(prev => [photoCard, ...prev]);
                setPhotos(prev => {
                  const newPhotos = data.photos.map((p: any) => ({ ...p, id: Math.random().toString(36).substring(7), title: args.query || args.category || 'Foto' }));
                  const updated = [...prev, ...newPhotos];
                  newPhotos.forEach((p: any) => syncService.addToQueue('photos', { ...p, uid }));
                  apiFetch('/api/db/photos', {
                    method: 'POST',
                    body: JSON.stringify({ uid, photos: updated })
                  }).catch(err => console.warn('Falha no salvamento das fotos:', err));
                  return updated;
                });
                addNotification(`Fotos: ${data.photos.length} imagens encontradas`, 'success');
                if (apiKey) {
                  searchService.saveSearch(uid, {
                    query: args.query || args.category || 'Busca de fotos',
                    type: 'photos',
                    results: data.photos,
                    summary: `Busca no Google Fotos retornou ${data.photos.length} imagens.`,
                    sessionId: sessionId || undefined
                  }, isLocalStorageEnabled ? 'local' : 'memory');
                }
              } else if (name === 'photos_delete') {
                addNotification(`Fotos: Imagem excluída com sucesso`, 'success');
              } else if (name === 'vision_analyze') {
                const visionCard = { 
                  id: cardId, 
                  type: 'note' as const, 
                  query: 'Análise de Imagem', 
                  content: `### Resultados da Cloud Vision API\n\n**Labels:** ${data.result.labelAnnotations?.map((l: any) => l.description).join(', ') || 'Nenhum'}\n\n**Texto Detectado:**\n${data.result.fullTextAnnotation?.text || 'Nenhum'}\n\n**Propriedades:** ${data.result.imagePropertiesAnnotation?.dominantColors?.colors?.length || 0} cores dominantes detectadas.`,
                  timestamp: Date.now() 
                };
                setSearchResults(prev => [visionCard, ...prev]);
                addNotification(`Vision: Análise concluída`, 'success');
              }
            } else {
              result = { error: data.error };
              if (data.error?.includes('insufficient authentication scopes') || data.error?.includes('scopes')) {
                addNotification(`Permissão negada para ${name}. Desconecte e faça login novamente marcando a permissão do Google Fotos.`, 'error');
              } else {
                addNotification(`Erro em ${name}: ${data.error}`, 'error');
              }
              updateTask(taskId, { status: 'error' });
            }
          }
          
          updateTask(taskId, { progress: 100, status: 'completed' });
          removeTask(taskId);
          setSearchProgress(prev => ({ ...prev, progress: 100 }));
          setTimeout(() => setSearchProgress({ active: false, label: '', progress: 0 }), 500);
        } catch (err: any) {
          result = { error: err.message };
          updateTask(taskId, { status: 'error' });
          removeTask(taskId);
          setSearchProgress({ active: false, label: '', progress: 0 });
          if (err.message?.includes('insufficient authentication scopes') || err.message?.includes('scopes')) {
            addNotification(`Permissão negada. Desconecte e faça login novamente marcando a permissão do Google Fotos.`, 'error');
          } else {
            addNotification(`Erro na busca: ${err.message}`, 'error');
          }
        }
        
        responses.push({
          id,
          name,
          response: result
        });
      }
      
      if (liveServiceRef.current) {
        await liveServiceRef.current.sendToolResponse(responses);
      }
    };

    service.connect({
      onMessage: (message: LiveServerMessage) => {
        if (message.toolCall) {
          setAgentState('thinking');
          handleToolCall(message.toolCall);
        }
        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              setAgentState('speaking');
              const binary = atob(part.inlineData.data);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              const pcmData = new Int16Array(bytes.buffer);
              audioQueueRef.current.push(pcmData);
              if (isAudioOnRef.current) playAudioQueue();
            }
            if (part.text) {
              setTranscription(prev => prev + part.text);
              currentTurnTextRef.current += part.text;
            }
          }
        }
        
        // Handle grounding metadata (Google Search sources)
        const groundingMetadata = (message.serverContent?.modelTurn as any)?.groundingMetadata;
        if (groundingMetadata?.groundingChunks) {
          setSearchProgress({ active: true, label: 'Busca Web Concluída', progress: 100 });
          setTimeout(() => setSearchProgress({ active: false, label: '', progress: 0 }), 1000);
          addNotification('Busca Web concluída', 'success');
          
          const sources = groundingMetadata.groundingChunks
            .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
            .map((chunk: any) => ({
              title: chunk.web.title,
              uri: chunk.web.uri
            }));
            
          if (sources.length > 0) {
            const cardId = Math.random().toString(36).substring(7);
            const isReport = currentTurnTextRef.current.length > 200 || currentTurnTextRef.current.includes('Protocolo Mari');
            
            // Look for recent youtube results to attach to the report
            const recentYoutubeResults = searchResults.find(r => r.type === 'youtube' && Date.now() - r.timestamp < 60000)?.results || [];

            setSearchResults(prev => [
              { 
                id: cardId, 
                type: isReport ? 'report' : 'web', 
                query: isReport ? 'Reportagem Mari' : 'Pesquisa Web', 
                results: sources.map((s: any) => ({ ...s, summary: currentTurnTextRef.current, isReport })), 
                youtubeVideos: recentYoutubeResults,
                timestamp: Date.now() 
              }, 
              ...prev
            ]);
            
            // Save web search to history
            searchService.saveSearch(uid, {
              query: isReport ? 'Reportagem Mari' : 'Busca Web',
              type: 'web',
              results: sources.map((s: any) => ({ ...s, summary: currentTurnTextRef.current, isReport })),
              summary: currentTurnTextRef.current,
              sessionId: sessionId || undefined
            }, isLocalStorageEnabled ? 'local' : 'memory');
          }
        }

        if (message.serverContent?.turnComplete) {
          currentTurnTextRef.current = '';
        }

        if (message.serverContent?.interrupted) {
          stopAudio();
          currentTurnTextRef.current = '';
        }
      },
      onError: (err) => {
        const msg = err.message || String(err);
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          setError("⚠️ Limite de Cota Excedido no Modo Live. Por favor, aguarde 1 minuto ou alterne para outra API Key nas configurações.");
          addNotification("Cota do Gemini Live esgotada.", "error");
        } else {
          setError(`Erro na sessão: ${msg}`);
        }
      },
      onStatusChange: (newStatus) => setStatus(newStatus)
    }, `Você é o JESUS I.A. 360° em MODO LIVE, operando sob o Protocolo Mari (Motor Acadêmico de Redação Inteligente).
    
    OBJETIVO: Transformar buscas em reportagens ou notas elegantes estilo "revista eletrônica" com rigor acadêmico e clareza.
    
    DIRETRIZES DO PROTOCOLO MARI:
    1. MULTIMODALIDADE: Use Google Search (Search Engine) e YouTube via Vertex AI para compilar informações.
    2. ESTRUTURA EDITORIAL: Redija textos com Título Impactante, Introdução clara (com letra maiúscula inicial), Desenvolvimento com subtítulos elegantes e Conclusão.
    3. RIGOR ACADÊMICO E ELEGÂNCIA: Utilize linguagem formal, técnica, mas acessível e elegante.
    4. CITAÇÕES E LINKS: Inclua links diretos para os locais de onde a informação foi obtida.
    5. FONTES (PESQUISA RÁPIDA): Use menos fontes (5 ou 6 fontes de pesquisa pelo search engine) para manter a nota concisa e elegante. Apresente as fontes de forma organizada e limpa (colapsadas ou em uma lista discreta) no final da nota.
    6. VÍDEOS E IMAGENS: Incorpore vídeos do YouTube usando a tag [VIDEO:url_do_youtube] e imagens usando a tag [IMAGE:prompt_em_ingles] quando relevante.
    7. FORMATAÇÃO LIMPA (MARKDOWN): Use Markdown rico e bem estruturado. Organize com bullet points claros. EVITE textos confusos, desconexos ou cheios de asteriscos soltos. O texto deve ser fácil de ler e visualmente agradável.
    
    Sempre que o usuário pedir uma busca ou reportagem, siga este protocolo rigorosamente.`, voiceName, isConversationModeActive);

    return () => {
      service.disconnect();
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      audioContextRef.current?.close();
    };
  }, [apiKey, voiceName, playAudioQueue, isLiveActive, isConversationModeActive]);

  useEffect(() => {
    let interval: any;
    if (agentState === 'thinking' && !searchProgress.active) {
      const taskId = addTask('Analisando dados neurais...');
      updateTask(taskId, { status: 'processing' });
      
      setSearchProgress({ active: true, label: 'Analisando dados neurais...', progress: 10 });
      let p = 10;
      interval = setInterval(() => {
        p += Math.random() * 15;
        if (p > 95) p = 95;
        setSearchProgress(prev => ({ ...prev, progress: Math.floor(p) }));
        updateTask(taskId, { progress: Math.floor(p) });
      }, 800);

      return () => {
        clearInterval(interval);
        updateTask(taskId, { progress: 100, status: 'completed' });
        removeTask(taskId);
      };
    } else if (agentState !== 'thinking' && searchProgress.active && searchProgress.label === 'Analisando dados neurais...') {
      setSearchProgress(prev => ({ ...prev, progress: 100 }));
      setTimeout(() => setSearchProgress({ active: false, label: '', progress: 0 }), 500);
    }
    return () => clearInterval(interval);
  }, [agentState]);

  useEffect(() => {
    if (status === LiveConnectionStatus.ACTIVE) {
      setupAudio();
    }
  }, [status, setupAudio]);

  useEffect(() => {
    if (isVideoOn && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isVideoOn, mediaStreamRef.current]);

  // Video frame capture loop
  useEffect(() => {
    if (!isVideoOn || !liveServiceRef.current || status !== LiveConnectionStatus.ACTIVE) return;

    const captureFrame = () => {
      if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          context.drawImage(videoRef.current, 0, 0, 320, 240);
          const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
          liveServiceRef.current?.sendVideo(base64Data);
        }
      }
      requestAnimationFrame(captureFrame);
    };

    const handle = requestAnimationFrame(captureFrame);
    return () => cancelAnimationFrame(handle);
  }, [isVideoOn, status]);

  const isConnecting = isLiveActive && (status === LiveConnectionStatus.CONNECTING || status === LiveConnectionStatus.IDLE);

  return (
    <>
      <AnimatePresence mode="wait">
        {isMinimized ? (
        <motion.div
          key="minimized"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl"
        >
          <div className="flex items-center gap-3 pr-4 border-r border-white/10">
            <div className={`w-2.5 h-2.5 rounded-full ${!isLiveActive ? 'bg-zinc-600' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-xs font-medium text-white/80 whitespace-nowrap">JESUS I.A. Live</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsConversationModeActive(!isConversationModeActive);
                if (liveServiceRef.current) {
                  liveServiceRef.current.disconnect();
                }
                addNotification(isConversationModeActive ? "Modo Conversa Desativado" : "Modo Conversa Ativado", "info");
              }}
              className={`p-2.5 rounded-full transition-all ${isConversationModeActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title={isConversationModeActive ? 'Desativar Modo Conversa' : 'Ativar Modo Conversa'}
            >
              {isConversationModeActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-2.5 rounded-full transition-all ${isMicOn ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setIsMinimized(false)}
              className="p-2.5 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-all"
              title="Expandir"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button 
              onClick={onClose}
              className="p-2.5 rounded-full bg-zinc-800/50 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="maximized"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-50 bg-zinc-950 flex flex-col"
        >
          {/* Top Bar */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md z-50 gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsLiveActive(!isLiveActive)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${isLiveActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-500'}`}
              >
                {isLiveActive ? 'JESUS I.A. ATIVO' : 'STANDBY'}
              </button>
            </div>

            {/* Consolidated Controls */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {/* Chat Controls */}
              <div className="flex items-center gap-1 bg-zinc-800/30 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setIsMicOn(!isMicOn)}
                  className={`p-1.5 rounded-lg transition-all ${isMicOn ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => setIsVideoOn(!isVideoOn)}
                  className={`p-1.5 rounded-lg transition-all ${isVideoOn ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isVideoOn ? <Camera className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => setIsAudioOn(!isAudioOn)}
                  className={`p-1.5 rounded-lg transition-all ${isAudioOn ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
                >
                  {isAudioOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Video Playback Controls */}
              {isVideoOn && (
                <div className="flex items-center gap-2 bg-zinc-800/30 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                    className="p-1.5 rounded-lg transition-all bg-zinc-800 text-zinc-500 hover:text-white"
                    title="Play/Pause Vídeo"
                  >
                    {videoRef.current?.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex items-center gap-2 px-2">
                    <Volume2 className="w-3 h-3 text-zinc-500" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      defaultValue="1"
                      onChange={(e) => {
                        if (videoRef.current) {
                          videoRef.current.volume = parseFloat(e.target.value);
                        }
                      }}
                      className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Quick Modes */}
              <div className="flex items-center gap-1 bg-zinc-800/30 p-1 rounded-xl border border-white/5">
                {[
                  { id: 'drive', icon: HardDrive },
                  { id: 'youtube', icon: Youtube },
                  { id: 'tasks', icon: CheckSquare },
                  { id: 'calendar', icon: Calendar },
                  { id: 'revista', icon: BookOpen },
                  { id: 'photos', icon: Image },
                  { id: 'image', icon: Zap },
                  { id: 'vision', icon: Camera },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleQuickMode(mode.id as QuickMode)}
                    className={`p-1.5 rounded-lg transition-all ${activeQuickMode === mode.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <mode.icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-zinc-800/30 p-1 rounded-xl border border-white/5">
                <button 
                  onClick={() => setActiveTab('active')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${activeTab === 'active' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Ativos
                </button>
                <button 
                  onClick={() => setActiveTab('archived')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg uppercase tracking-wider transition-all ${activeTab === 'archived' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Arquivados ({savedCards.length})
                </button>
              </div>

              <button 
                onClick={() => whiteboardManager.open()}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-[10px] font-bold uppercase tracking-widest"
                title="Abrir Monitor B (Lousa)"
              >
                <Layout className="w-3.5 h-3.5" />
                Monitor B
              </button>
            </div>

            <div className="flex items-center gap-4">
              {isVideoOn && (
                <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-white/10 bg-black">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" width={320} height={240} />
                </div>
              )}
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-red-500/10 text-red-500 rounded-full text-xs font-bold uppercase tracking-wider border border-red-500/20 hover:bg-red-500/20"
              >
                Salvar / Encerrar
              </button>
              <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12 relative">
            {/* Floating Task Queue Indicator */}
            <div className="fixed top-20 right-8 z-40">
              <AnimatePresence>
                {taskQueue.length > 0 && (
                  <div className="flex flex-col items-end gap-2">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onClick={() => setShowDetailedTasks(!showDetailedTasks)}
                      className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl cursor-pointer hover:bg-zinc-800 transition-all shadow-2xl"
                    >
                      <div className="flex items-center gap-2 mr-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tarefas Ativas ({taskQueue.length})</span>
                      </div>
                      <div className="flex -space-x-2">
                        {taskQueue.map((task, idx) => (
                          <div 
                            key={task.id} 
                            className={`w-6 h-6 rounded-full border-2 border-zinc-900 flex items-center justify-center text-[8px] font-bold transition-all ${
                              task.status === 'completed' ? 'bg-emerald-500 text-white' : 
                              task.status === 'processing' ? 'bg-indigo-500 text-white animate-pulse' : 
                              'bg-zinc-700 text-zinc-400'
                            }`}
                          >
                            {task.status === 'completed' ? '✓' : idx + 1}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                    
                    {showDetailedTasks && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="w-64 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 space-y-4 shadow-2xl"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Fila de Processamento</span>
                          <button onClick={() => setShowDetailedTasks(false)} className="text-zinc-500 hover:text-white">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {taskQueue.map(task => (
                          <div key={task.id} className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-medium">
                              <span className="text-zinc-300 truncate pr-2">{task.label}</span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setTaskQueue(prev => prev.filter(t => t.id !== task.id))}
                                  className="p-1 hover:bg-red-900/50 rounded text-zinc-500 hover:text-red-400"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${task.progress}%` }}
                                className={`h-full ${task.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              />
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {searchProgress.active && (
                <SearchProgressHalo progress={searchProgress.progress} label={searchProgress.label} />
              )}
            </AnimatePresence>
            
            {activeTab === 'active' ? (
              <>
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Resultados de Pesquisa</h3>
                  </div>
                )}
                {/* Active Search Results */}
                <AnimatePresence mode="popLayout">
                    {searchResults.map((search) => {
                      const isMaximized = maximizedCardId === search.id;
                      const isCollapsed = collapsedCardIds.has(search.id);
                      
                      if (search.type === 'report') {
                        return (
                          <MariReportCard 
                            key={search.id}
                            id={search.id}
                            title={search.query}
                            content={search.results?.[0]?.summary || search.content || ''}
                            sources={search.results || []}
                            youtubeVideos={search.youtubeVideos || []}
                            onSave={() => handleSaveCard(search)}
                            onDelete={() => handleDeleteCard(search.id)}
                            onCopy={() => handleCopyCard(search.results?.[0]?.summary || search.content || '')}
                            onView={() => setShowMagazine(search)}
                            isMaximized={isMaximized}
                            onToggleMaximize={() => toggleMaximize(search.id)}
                          />
                        );
                      }

                      return (
                        <motion.div 
                        key={search.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0,
                          scale: isMaximized ? 1.02 : 1,
                          zIndex: isMaximized ? 40 : 1
                        }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-xl overflow-hidden transition-all duration-300 ${isMaximized ? 'ring-2 ring-indigo-500/50' : ''}`}
                      >
                        {/* Card Header */}
                        <div className="p-6 flex items-center justify-between border-b border-white/5 bg-white/2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${
                              search.type === 'youtube' ? 'bg-red-500/10 text-red-500' :
                              search.type === 'drive' ? 'bg-blue-500/10 text-blue-500' :
                              search.type === 'map' ? 'bg-emerald-500/10 text-emerald-500' :
                              search.type === 'report' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-indigo-500/10 text-indigo-500'
                            }`}>
                              {search.type === 'youtube' ? <Video className="w-5 h-5" /> : search.type === 'map' ? <Search className="w-5 h-5" /> : search.type === 'report' ? <FileText className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                {search.type === 'youtube' ? 'YouTube' : search.type === 'drive' ? 'Google Drive' : search.type === 'map' ? 'Mapa JESUS I.A.' : search.type === 'report' ? 'Reportagem MARE' : 'Pesquisa Web'}
                              </h4>
                              <p className="text-xs text-zinc-500">"{search.query}"</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => toggleCollapse(search.id)}
                              className="p-2 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors"
                              title={isCollapsed ? "Expandir" : "Recolher"}
                            >
                              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => toggleMaximize(search.id)}
                              className="p-2 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors"
                              title={isMaximized ? "Restaurar" : "Aumentar"}
                            >
                              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <button 
                              onClick={() => {
                                const cardData = {
                                  id: search.id,
                                  type: search.type,
                                  title: search.query,
                                  content: search.results?.[0]?.summary || search.content || ''
                                };
                                whiteboardManager.send({ type: 'ADD_CARD', card: cardData });
                                addNotification("Enviado para Lousa", "success");
                              }}
                              className="p-2 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors"
                              title="Enviar para Lousa (Monitor B)"
                            >
                              <Layout className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => startEditing(search)}
                              className="p-2 hover:bg-white/10 text-zinc-400 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleArchiveCard(search)}
                              className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                              title="Arquivar"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCard(search.id)}
                              className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Card Content */}
                        <AnimatePresence>
                          {!isCollapsed && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="p-6"
                            >
                              <div className="grid grid-cols-1 gap-4">
                                {editingCardId === search.id ? (
                                  <div className="space-y-3">
                                    <textarea 
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingCardId(null)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancelar</button>
                                      <button onClick={() => handleEditCard(search.id, editValue)} className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg">Salvar</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {search.type === 'map' && (
                                      <div className={`${isMaximized ? 'h-[500px]' : 'h-[300px]'} w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg transition-all duration-300`}>
                                        <MapComponent 
                                          center={[search.lat, search.lng]} 
                                          zoom={13} 
                                          markers={search.markers?.map((m: any) => ({
                                            position: [m.lat, m.lng],
                                            title: m.title,
                                            description: m.description
                                          }))}
                                          route={search.route}
                                        />
                                      </div>
                                    )}

                                    {search.type === 'youtube' && (
                                      <div className="space-y-4">
                                        <div className={`grid ${isMaximized ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'} gap-3`}>
                                          {search.results?.map((video: any, j: number) => (
                                            <div key={j} className="bg-black/40 rounded-xl overflow-hidden border border-white/5 group relative flex flex-col">
                                              <div className="aspect-video relative overflow-hidden">
                                                <img 
                                                  src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`} 
                                                  alt={video.title}
                                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                  referrerPolicy="no-referrer"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <button 
                                                    onClick={() => window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank')}
                                                    className="p-2 bg-red-600 rounded-full text-white shadow-xl transform scale-75 group-hover:scale-100 transition-transform"
                                                  >
                                                    <Play className="w-5 h-5 fill-current" />
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="p-2 flex flex-col gap-1.5 bg-zinc-900/50 flex-1">
                                                <div className="min-w-0">
                                                  <h5 className="text-[10px] font-bold text-white truncate leading-tight" title={video.title}>{video.title}</h5>
                                                  <p className="text-[8px] text-zinc-500 mt-0.5 uppercase tracking-widest truncate">{video.channelTitle}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-white/5">
                                                  <div className="flex items-center gap-1">
                                                    <button 
                                                      onClick={() => {
                                                        whiteboardManager.send({ 
                                                          type: 'ADD_CARD', 
                                                          card: { 
                                                            id: video.id, 
                                                            type: 'youtube', 
                                                            title: video.title, 
                                                            content: `### ${video.title}\n\n[VIDEO:https://www.youtube.com/watch?v=${video.id}]\n\nCanal: ${video.channelTitle}` 
                                                          } 
                                                        });
                                                        addNotification("Vídeo enviado para Lousa", "success");
                                                      }}
                                                      className="p-1 bg-white/5 hover:bg-indigo-500/20 text-zinc-400 hover:text-indigo-400 rounded-lg transition-all"
                                                      title="Enviar para Lousa (Monitor B)"
                                                    >
                                                      <Layout className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                      onClick={() => handleSaveVideo(video, search.query)}
                                                      className="p-1 bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                                                      title="Salvar este vídeo"
                                                    >
                                                      <ShieldCheck className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                  <a 
                                                    href={`https://www.youtube.com/watch?v=${video.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 rounded-lg transition-all"
                                                    title="Ver no YouTube"
                                                  >
                                                    <ExternalLink className="w-3 h-3" />
                                                  </a>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex gap-3">
                                          <button 
                                            onClick={() => handleSaveCard(search)}
                                            className="flex-1 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                          >
                                            <Video className="w-4 h-4" />
                                            Salvar Todos
                                          </button>
                                          <button 
                                            onClick={() => {
                                              whiteboardManager.send({ 
                                                type: 'ADD_CARD', 
                                                card: { 
                                                  id: search.id, 
                                                  type: 'youtube_list', 
                                                  title: `Playlist: ${search.query}`, 
                                                  content: `### Busca YouTube: ${search.query}\n\n${search.results?.map((v: any) => `* [${v.title}](https://www.youtube.com/watch?v=${v.id})`).join('\n')}` 
                                                } 
                                              });
                                              addNotification("Lista enviada para Lousa", "success");
                                            }}
                                            className="flex-1 py-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                          >
                                            <Layout className="w-4 h-4" />
                                            Enviar Lista para B
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {search.type === 'drive' && (
                                      <div className="space-y-6">
                                        {(() => {
                                          const grouped = (search.results || []).reduce((acc: any, file: any) => {
                                            let type = 'Outros';
                                            if (file.mimeType?.includes('spreadsheet')) type = 'Planilhas';
                                            else if (file.mimeType?.includes('document')) type = 'Documentos';
                                            else if (file.mimeType?.includes('presentation')) type = 'Apresentações';
                                            else if (file.mimeType?.includes('pdf')) type = 'PDFs';
                                            else if (file.mimeType?.includes('folder')) type = 'Pastas';
                                            
                                            if (!acc[type]) acc[type] = [];
                                            acc[type].push(file);
                                            return acc;
                                          }, {});

                                          return Object.entries(grouped).map(([type, files]: [string, any]) => (
                                            <div key={type} className="space-y-3">
                                              <div className="flex items-center gap-2 px-1">
                                                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                                                <h6 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{type}</h6>
                                                <span className="text-[10px] text-zinc-600 ml-auto">{files.length} itens</span>
                                              </div>
                                              <div className="grid grid-cols-1 gap-2">
                                                {files.map((file: any, j: number) => (
                                                  <div key={j} className={`p-3 bg-white/2 rounded-xl border transition-all group ${
                                                    file.similarityColor === 'green' ? 'border-emerald-500/30 bg-emerald-500/5' :
                                                    file.similarityColor === 'yellow' ? 'border-yellow-500/30 bg-yellow-500/5' :
                                                    'border-white/5 hover:border-blue-500/20'
                                                  }`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                          file.similarityColor === 'green' ? 'bg-emerald-500/10 text-emerald-400' :
                                                          file.similarityColor === 'yellow' ? 'bg-yellow-500/10 text-yellow-400' :
                                                          'bg-blue-500/10 text-blue-400'
                                                        }`}>
                                                          <HardDrive className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                          <div className="flex items-center gap-2 mb-0.5">
                                                            <h5 className="text-xs font-bold text-white truncate">{file.name}</h5>
                                                            {file.similarityColor === 'green' && (
                                                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase tracking-tighter">Alta Relevância</span>
                                                            )}
                                                          </div>
                                                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                            <p className="text-[9px] text-zinc-500 flex items-center gap-1">
                                                              <Clock className="w-2.5 h-2.5" />
                                                              Criado: {new Date(file.createdTime).toLocaleDateString('pt-BR')}
                                                            </p>
                                                            <p className="text-[9px] text-zinc-500 flex items-center gap-1">
                                                              <Activity className="w-2.5 h-2.5" />
                                                              Modificado: {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}
                                                            </p>
                                                            <p className="text-[9px] text-zinc-600 italic truncate max-w-[150px]">
                                                              {file.folderName}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                          onClick={() => {
                                                            whiteboardManager.send({ 
                                                              type: 'ADD_CARD', 
                                                              card: { 
                                                                id: file.id, 
                                                                type: 'drive_file', 
                                                                title: file.name, 
                                                                content: `### Arquivo Drive: ${file.name}\n\nLink: [${file.webViewLink}](${file.webViewLink})\n\nTipo: ${file.mimeType}` 
                                                              } 
                                                            });
                                                            addNotification("Arquivo enviado para Lousa", "success");
                                                          }}
                                                          className="p-2 text-zinc-500 hover:text-indigo-400 transition-colors"
                                                          title="Enviar para Lousa (Monitor B)"
                                                        >
                                                          <Layout className="w-4 h-4" />
                                                        </button>
                                                        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="p-2 text-zinc-500 hover:text-blue-400 transition-colors">
                                                          <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ));
                                        })()}
                                      </div>
                                    )}

                                    {search.type === 'photos' && (
                                      <div className="space-y-4">
                                        <MariPhotoGallery 
                                          photos={search.results || []} 
                                          onDelete={async (id) => {
                                            const res = await fetch('/api/tools/photos/delete', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ mediaItemId: id }),
                                              credentials: 'include'
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                              addNotification('Imagem excluída com sucesso', 'success');
                                              setSearchResults(prev => prev.map(s => 
                                                s.id === search.id ? { ...s, results: s.results.filter((p: any) => p.id !== id) } : s
                                              ));
                                            } else {
                                              addNotification(`Erro ao excluir: ${data.error}`, 'error');
                                            }
                                          }}
                                          onSaveToGallery={(photo) => {
                                            handleSaveCard({
                                              id: Math.random().toString(36).substring(7),
                                              type: 'photos',
                                              query: photo.title,
                                              results: [photo],
                                              timestamp: Date.now()
                                            });
                                            addNotification('Imagem salva na galeria', 'success');
                                          }}
                                        />
                                      </div>
                                    )}

                                    {search.type === 'web' && (
                                      <div className="space-y-4">
                                        <div className="bg-indigo-500/5 rounded-2xl p-4 border border-indigo-500/10">
                                          <p className="text-xs text-indigo-300 font-medium mb-2 flex items-center gap-2">
                                            <Brain className="w-3 h-3" /> Síntese Inteligente JESUS I.A.
                                          </p>
                                          <div className="text-sm text-zinc-300 leading-relaxed">
                                            <MarkdownRenderer content={search.results?.[0]?.summary || "Processando informações coletadas..."} />
                                            <div className="mt-2">
                                              <TTSPlayer text={search.results?.[0]?.summary || ""} />
                                            </div>
                                          </div>
                                          <button 
                                            onClick={() => setShowMagazine(search)}
                                            className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                                          >
                                            <Eye className="w-3 h-3" /> Abrir em Formato Revista
                                          </button>
                                        </div>

                                        <div className="space-y-2">
                                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Fontes de Referência</p>
                                          {search.results?.map((source: any, j: number) => (
                                            <div key={j} className="p-3 bg-white/2 rounded-xl border border-white/5 hover:border-indigo-500/20 transition-all group">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                  <div className="w-6 h-6 bg-indigo-500/10 rounded-lg flex items-center justify-center text-[10px]">
                                                    {j + 1}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <h5 className="text-xs font-medium text-white truncate">{source.title}</h5>
                                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400/70 hover:text-indigo-400 truncate block">
                                                      {source.uri}
                                                    </a>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <button 
                                                    onClick={() => {
                                                      whiteboardManager.send({ 
                                                        type: 'ADD_CARD', 
                                                        card: { 
                                                          id: Math.random().toString(36).substring(7), 
                                                          type: 'web_link', 
                                                          title: source.title, 
                                                          content: `### ${source.title}\n\nFonte: [${source.uri}](${source.uri})` 
                                                        } 
                                                      });
                                                      addNotification("Link enviado para Lousa", "success");
                                                    }}
                                                    className="p-1.5 text-zinc-500 hover:text-indigo-400 transition-colors"
                                                    title="Enviar para Lousa (Monitor B)"
                                                  >
                                                    <Layout className="w-3.5 h-3.5" />
                                                  </button>
                                                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-500 hover:text-white transition-colors">
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                  </a>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Loading Halo for Main Feed */}
              {searchProgress.active && (
                <div className="mb-8">
                  <SearchProgressHalo progress={searchProgress.progress} label={searchProgress.label} />
                </div>
              )}

              {searchResults.length === 0 && !searchProgress.active && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-20">
                    <Search className="w-16 h-16 mb-4" />
                    <p className="text-lg font-medium">Nenhuma pesquisa ativa</p>
                    <p className="text-sm">Os resultados das suas pesquisas aparecerão aqui.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Saved Cards Section */}
                <AnimatePresence mode="popLayout">
                  {savedCards.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] px-2">Arquivados Recentemente</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {savedCards.map((card) => {
                          const isMaximized = maximizedCardId === card.id;
                          
                          if (card.type === 'report') {
                            return (
                              <MariReportCard 
                                key={card.id}
                                id={card.id}
                                title={card.title}
                                content={card.content || ''}
                                sources={card.results || []}
                                youtubeVideos={card.youtubeVideos || []}
                                onSave={() => handleSaveCard(card)}
                                onDelete={() => handleDeleteCard(card.id, true)}
                                onCopy={() => handleCopyCard(card.content || '')}
                                onView={() => setShowMagazine(card)}
                                isMaximized={isMaximized}
                                onToggleMaximize={() => toggleMaximize(card.id)}
                              />
                            );
                          }

                          return (
                            <motion.div 
                            key={card.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 hover:border-white/10 transition-all group"
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/5 rounded-xl text-zinc-400">
                                  {card.type === 'note' ? <MessageSquareText className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                </div>
                                <div>
                                  <h4 className="text-sm font-medium text-white">{card.title}</h4>
                                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                                    {new Date(card.timestamp).toLocaleDateString()} • {new Date(card.timestamp).toLocaleTimeString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    whiteboardManager.send({ 
                                      type: 'ADD_CARD', 
                                      card: { id: card.id, type: card.type, title: card.title, content: card.content || card.query } 
                                    });
                                    addNotification("Enviado para Lousa", "success");
                                  }}
                                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                                  title="Enviar para Lousa (Monitor B)"
                                >
                                  <Layout className="w-4 h-4" />
                                </button>
                                {card.type === 'note' && (
                                  <button 
                                    onClick={() => playNote(card.content, card.id)}
                                    className={`p-2 transition-colors ${isPlayingNote === card.id ? 'text-indigo-400' : 'text-zinc-500 hover:text-white'}`}
                                    title="Ouvir Nota"
                                  >
                                    {isPlayingNote === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                                  </button>
                                )}
                                <button 
                                  onClick={() => startEditing(card)}
                                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                                  title="Editar"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleCopyCard(card.content || card.query)}
                                  className="p-2 text-zinc-500 hover:text-white transition-colors"
                                  title="Copiar Conteúdo"
                                >
                                  <Zap className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCard(card.id, true)}
                                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                                  title="Excluir"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {editingCardId === card.id ? (
                              <div className="mt-4 space-y-3">
                                <textarea 
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px]"
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingCardId(null)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">Cancelar</button>
                                  <button onClick={() => handleEditCard(card.id, editValue, true)} className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg">Salvar</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {card.type === 'map' && (
                                  <div className="h-[200px] w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg mb-3">
                                    <MapComponent 
                                      center={[card.lat, card.lng]} 
                                      zoom={13} 
                                      markers={card.markers?.map((m: any) => ({
                                        position: [m.lat, m.lng],
                                        title: m.title,
                                        description: m.description
                                      }))}
                                      route={card.route}
                                    />
                                  </div>
                                )}

                                {card.type === 'note' && (
                              <div className="text-sm text-zinc-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                <MarkdownRenderer content={card.content} />
                              </div>
                            )}

                            {card.type === 'youtube' && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl border border-white/5">
                                  <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
                                    <Video className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">{card.results?.[0]?.title || card.query}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{card.results?.length || 0} vídeos salvos</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {card.results?.slice(0, 2).map((video: any, idx: number) => (
                                    <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-white/5">
                                      <img src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {card.type === 'drive' && (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl border border-white/5">
                                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                                    <HardDrive className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">{card.results?.[0]?.name || card.query}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{card.results?.length || 0} arquivos salvos</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {card.results?.slice(0, 3).map((file: any, idx: number) => (
                                    <a key={idx} href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">
                                      • {file.name}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {card.type === 'web' && (
                              <div className="space-y-2">
                                {card.results?.slice(0, 3).map((source: any, idx: number) => (
                                  <div key={idx} className="text-xs text-indigo-400 hover:underline truncate block">
                                    • {source.title}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-20">
                      <Zap className="w-16 h-16 mb-4" />
                      <p className="text-lg font-medium">Nenhum card arquivado</p>
                      <p className="text-sm">Salve resultados de pesquisas ou notas para vê-los aqui.</p>
                    </div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

  {/* Magazine View Modal */}
      <AnimatePresence>
        {showMagazine && (
          <RevistaEletronica 
            report={{
              id: showMagazine.id,
              title: showMagazine.query || showMagazine.title || 'Sem Título',
              content: showMagazine.results?.[0]?.text || showMagazine.results?.[0]?.summary || showMagazine.content || "Conteúdo em processamento...",
              sources: showMagazine.results || showMagazine.sources || [],
              youtubeVideos: showMagazine.youtubeVideos || [],
              createdAt: showMagazine.timestamp || Date.now()
            }}
            onClose={() => setShowMagazine(null)}
            onNext={onNext}
            onPrev={onPrev}
            onSave={() => {
              syncService.addToQueue('cards', { ...showMagazine, uid });
              apiFetch('/api/db/cards', {
                method: 'POST',
                body: JSON.stringify({ ...showMagazine, uid })
              }).catch(err => console.warn('Falha na atualização imediata:', err));
              addNotification("Reportagem salva no banco de dados.", "success");
            }}
            addNotification={addNotification}
          />
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`p-3 rounded-xl shadow-lg border flex items-center gap-3 min-w-[250px] backdrop-blur-md ${
                notification.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                notification.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span className="text-xs font-medium">{notification.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

export default GeminiLive;
