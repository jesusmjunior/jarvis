import React, { useState, useEffect, useRef } from 'react';
import { errorService, ErrorCategory } from './services/errorService';
import { ToastContainer } from './components/Toast';
import { getGeminiResponse, jarvisSystemInstruction, transcribeAudio } from './services/geminiChat';
import { checkApprovalRequired, Plan } from './services/approvalService';
import { saveMemory, getMemory, exportMemory, importMemory, MemoryEntry, getMemoryLayer, memoryService, ChatSession } from './services/memoryService';
import ApiKeyManager from './components/ApiKeyManager';
import { VideoPlayer } from './components/VideoPlayer';
import { useApiKey } from './contexts/ApiKeyContext';
import Jarvis360 from './components/Jarvis360';
import GoogleProductivity from './components/GoogleProductivity';
import GoogleWorkspaceDashboard from './components/GoogleWorkspaceDashboard';
import GoogleCalendarDashboard from './components/GoogleCalendarDashboard';
import GoogleTasksDashboard from './components/GoogleTasksDashboard';
import GoogleGmailDashboard from './components/GoogleGmailDashboard';
import GeminiLive from './components/GeminiLive';
import { TTSPlayer } from './components/TTSPlayer';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Brain, LogOut, Settings, Calendar, FileText, CheckSquare, Mail, Database, Loader2, Bell, ShieldAlert, Check, X, Eye, EyeOff, Play, Pause, Square, ExternalLink, Youtube, Info, ShieldCheck, Mic, Download, Upload, History, Volume2, Search, Globe, Zap, ThumbsUp, ThumbsDown, Archive, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw, StickyNote, Paperclip, CheckCircle2, AlertCircle, Folder, Cloud, HardDrive, Layout, Activity, Bookmark, BookOpen, Copy, Save, Plus, Table, Map as MapIcon, Image, CloudUpload, CloudDownload, Library } from 'lucide-react';
import { useSupabase } from './contexts/SupabaseContext';
import SupabaseConfigManager from './components/SupabaseConfigManager';
import QuickNotes from './components/QuickNotes';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { extractTextFromPDF } from './services/pdfService';
import { youtubeService } from './services/youtubeService';
import { searchService } from './services/searchService';
import { syncService, SyncProgress } from './services/syncService';
import { storageService, StorageConfig } from './services/storageService';
import SearchLibrary from './components/SearchLibrary';
import YouTubeLibrary from './components/YouTubeLibrary';
import DataTreeView from './components/DataTreeView';
import MemorySection from './components/MemorySection';
import { MetadataManager } from './components/MetadataManager';
import ReportCard from './components/ReportCard';
import { Report, archiveReport, protocoloMariResearch, getReports } from './services/reportService';
import { MariReportCard } from './components/MariReportCard';
import RevistaEletronica from './components/RevistaEletronica';
import RevistaEletronicaLibrary from './components/RevistaEletronicaLibrary';
import { SyncSidebar } from './components/SyncSidebar';
import { secrets } from './config/secrets';
import { Card } from './types';
import { CardLibrary } from './components/CardLibrary';
import UnifiedCardNotes from './components/UnifiedCardNotes';
import { persistenceService } from './services/persistenceService';
import { NotificationBell } from './components/NotificationBell';
import { MapComponent } from './components/MapComponent';
import { MapGallery } from './components/MapGallery';
import { GooglePhotosDashboard } from './components/GooglePhotosDashboard';
import { apiFetch } from './services/apiClient';
import { GalleryWrapper } from './components/GalleryWrapper';
import WhiteboardPopup from './components/WhiteboardPopup';
import PasswordScreen from './components/PasswordScreen';

interface SearchResult {
  title: string;
  source: string;
  link: string;
  summary: string;
  type: 'youtube' | 'web' | 'drive';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isSystem?: boolean;
  isApproval?: boolean;
  isArchived?: boolean;
  isClosed?: boolean;
  feedback?: 'positive' | 'negative';
  taskId?: string;
  searchResults?: SearchResult[];
  toolResult?: any;
  image?: string;
}

type QuickMode = 'drive' | 'youtube' | 'tasks' | 'calendar' | 'revista' | 'docs' | 'sheets' | null;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app_authenticated') === 'true';
  });

  const { isConnected: isSupabaseConnected, isTesting: isSupabaseTesting } = useSupabase();
  const [user, setUser] = useState<any>(null);
  const [isNoteApproved, setIsNoteApproved] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeQuickMode, setActiveQuickMode] = useState<QuickMode>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [maps, setMaps] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<Array<{id: string, title: string, progress: number}>>([]);
  const [showCardLibrary, setShowCardLibrary] = useState(false);
  const [showMapLibrary, setShowMapLibrary] = useState(false);
  const [showWorkspaceSync, setShowWorkspaceSync] = useState(false);
  const [activeDashboard, setActiveDashboard] = useState<'chat' | 'calendar' | 'tasks' | 'gmail' | 'maps' | 'photos' | 'cards'>('chat');
  const [workspaceCounts, setWorkspaceCounts] = useState({
    calendar: 0,
    gmail: 0,
    tasks: 0,
    cards: 0,
    maps: 0,
    photos: 0
  });
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  const handleUnlock = () => {
    setIsAuthenticated(true);
    localStorage.setItem('app_authenticated', 'true');
  };

  if (!isAuthenticated) {
    return <PasswordScreen onUnlock={handleUnlock} />;
  }

  if (window.location.pathname === '/whiteboard') {
    return <WhiteboardPopup />;
  }

  // ... existing state

  // Workspace Auto-Sync (Every 15 minutes)
  useEffect(() => {
    if (!user) return;

    const performSync = async () => {
      try {
        const res = await apiFetch('/api/db/google-sync', {
          method: 'POST',
          body: JSON.stringify({ uid: user.uid })
        });
        if (res.ok) {
          const data = await res.json();
          setWorkspaceCounts(prev => ({
            ...prev,
            calendar: data.events?.length || 0,
            tasks: data.tasks?.length || 0,
            gmail: data.gmail?.length || 0
          }));
          setLastSyncTime(Date.now());
        }
      } catch (error) {
        console.error('Auto-sync error:', error);
      }
    };

    // Initial sync
    performSync();

    const interval = setInterval(performSync, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Sync Maps and Photos with Supabase
  useEffect(() => {
    if (!user) return;

    const syncLocalData = async () => {
      try {
        // Sync Maps
        const mapsRes = await apiFetch(`/api/db/maps/${user.uid}`);
        if (mapsRes.ok) {
          const data = await mapsRes.json();
          if (data.maps) setMaps(data.maps);
          setWorkspaceCounts(prev => ({ ...prev, maps: data.maps?.length || 0 }));
        }

        // Sync Photos
        const photosRes = await apiFetch(`/api/db/photos/${user.uid}`);
        if (photosRes.ok) {
          const data = await photosRes.json();
          if (data.photos) setPhotos(data.photos);
          setWorkspaceCounts(prev => ({ ...prev, photos: data.photos?.length || 0 }));
        }
      } catch (error) {
        console.error('Local data sync error:', error);
      }
    };

    syncLocalData();
  }, [user]);

  // Update counts for cards, maps, and photos
  useEffect(() => {
    setWorkspaceCounts(prev => ({ ...prev, cards: cards.length }));
  }, [cards]);

  useEffect(() => {
    setWorkspaceCounts(prev => ({ ...prev, maps: maps.length }));
  }, [maps]);

  useEffect(() => {
    setWorkspaceCounts(prev => ({ ...prev, photos: photos.length }));
  }, [photos]);

  const addCard = (card: Card) => {
    setCards(prev => [...prev, card]);
    if (user) {
      // Use Persistence Service (L1: Memory, L2: Local, L3: Supabase)
      persistenceService.save(user.uid, 'cards', card);
      
      syncService.addToQueue('cards', { ...card, uid: user.uid });
      apiFetch('/api/db/cards', {
        method: 'POST',
        body: JSON.stringify({ ...card, uid: user.uid })
      }).catch(err => console.warn('Falha no salvamento imediato do card:', err));
    }
  };

  const updateCard = (updatedCard: Card) => {
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
    if (user) {
      // Use Persistence Service
      persistenceService.save(user.uid, 'cards', updatedCard);

      syncService.addToQueue('cards', { ...updatedCard, uid: user.uid });
      apiFetch('/api/db/cards', {
        method: 'POST',
        body: JSON.stringify({ ...updatedCard, uid: user.uid })
      }).catch(err => console.warn('Falha na atualização imediata do card:', err));
    }
  };

  const deleteCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    if (user) {
      apiFetch(`/api/db/cards/${id}`, { method: 'DELETE' })
        .catch(err => console.warn('Falha na exclusão imediata do card:', err));
    }
  };

  const addTask = (id: string, title: string) => {
    const newTask = { id, title, progress: 0, status: 'pending', acknowledged: false };
    setBackgroundTasks(prev => [...prev, newTask]);
    if (user) {
      apiFetch('/api/db/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...newTask, uid: user.uid })
      }).catch(err => console.warn('Falha ao salvar tarefa:', err));
    }
  };

  const updateTaskProgress = (id: string, progress: number) => {
    setBackgroundTasks(prev => prev.map(t => t.id === id ? { ...t, progress, status: progress === 100 ? 'completed' : 'pending' } : t));
    if (user) {
      apiFetch(`/api/db/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ progress, status: progress === 100 ? 'completed' : 'pending' })
      }).catch(err => console.warn('Falha ao atualizar tarefa:', err));
    }
  };

  const removeTask = (id: string) => {
    setBackgroundTasks(prev => prev.filter(t => t.id !== id));
    if (user) {
      apiFetch(`/api/db/tasks/${id}`, { method: 'DELETE' })
        .catch(err => console.warn('Falha ao remover tarefa:', err));
    }
  };

  const groupedSessions = sessions.reduce((acc, session) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let groupName = new Date().toLocaleDateString();
    if (new Date().toDateString() === today.toDateString()) {
      groupName = 'Hoje';
    } else if (new Date().toDateString() === yesterday.toDateString()) {
      groupName = 'Ontem';
    } else if (today.getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000) {
      groupName = 'Últimos 7 dias';
    } else if (today.getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000) {
      groupName = 'Últimos 30 dias';
    }

    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(session);
    return acc;
  }, {} as Record<string, ChatSession[]>);
  const [input, setInput] = useState('');
  const [showTaskSuggestion, setShowTaskSuggestion] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (user && isAuthReady) {
      apiFetch(`/api/db/tasks/${user.uid}`)
        .then(res => res.json())
        .then(setBackgroundTasks)
        .catch(err => console.warn('Falha ao carregar tarefas:', err));
    }
  }, [user, isAuthReady]);
  const [notification, setNotification] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeReport, setActiveReport] = useState<Report | null>(null);
  const [showRevista, setShowRevista] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ url: string; title?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGWorkspaceConnected, setIsGWorkspaceConnected] = useState(false);
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({ mode: 'memory' });

  useEffect(() => {
    storageService.init().then(() => {
      setStorageConfig(storageService.getConfig());
    });
  }, []);

  useEffect(() => {
    if (user && isAuthReady) {
      // Reload sessions after auth is ready
      memoryService.getSessions(user.uid).then(setSessions);
    }
  }, [user, isAuthReady]);
  const [showLiveMode, setShowLiveMode] = useState(false);
  const [showSearchLibrary, setShowSearchLibrary] = useState(false);
  const [showYouTubeLibrary, setShowYouTubeLibrary] = useState(false);
  const [closedMessages, setClosedMessages] = useState<string[]>([]);
  const [activeGenerations, setActiveGenerations] = useState<{id: string, query: string, progress: number, abortController: AbortController}[]>([]);

  const cancelGeneration = (id: string) => {
    const gen = activeGenerations.find(g => g.id === id);
    if (gen) {
      gen.abortController.abort();
      setActiveGenerations(prev => prev.filter(g => g.id !== id));
      addNotification('Geração cancelada.', 'info');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addNotification("Conteúdo copiado!", "success");
  };

  const closeMessage = (id: string) => {
    setClosedMessages(prev => [...prev, id]);
  };
  const [showDataTree, setShowDataTree] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ active: boolean; query: string; progress: number }>({ active: false, query: '', progress: 0 });
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'info' | 'success' | 'error' }[]>([]);

  const addNotification = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  const [selectedVoice, setSelectedVoice] = useState(() => {
    const saved = localStorage.getItem("jarvis_voice");
    return (saved === 'Kore' || saved === 'Puck') ? saved : 'Kore';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  useEffect(() => {
    localStorage.setItem("jarvis_voice", selectedVoice);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [selectedVoice, theme]);

  useEffect(() => {
    const taskKeywords = /^(lembre-me|lembrar|criar tarefa|adicionar tarefa|nova tarefa|agendar|anotar)\b/i;
    setShowTaskSuggestion(taskKeywords.test(input.trim()));
  }, [input]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAppHeaderCollapsed, setIsAppHeaderCollapsed] = useState(false);
  const [isQuickModesCollapsed, setIsQuickModesCollapsed] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcription, setTranscription] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        setTranscriptionProgress(0);
        const progressInterval = setInterval(() => {
          setTranscriptionProgress(prev => prev < 90 ? prev + 10 : 90);
        }, 200);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64Audio = (reader.result as string).split(',')[1];
              const text = await transcribeAudio(base64Audio, activeApiKey || "");
              setTranscription(text || "");
              setTranscriptionProgress(100);
            } catch (error) {
              errorService.log(error, ErrorCategory.GENERAL, 'Erro na transcrição de áudio.');
              addNotification('Erro ao transcrever áudio.', 'error');
            } finally {
              clearInterval(progressInterval);
              setIsTranscribing(false);
              setTranscriptionProgress(0);
            }
          };
        } catch (error) {
          clearInterval(progressInterval);
          setIsTranscribing(false);
          setTranscriptionProgress(0);
          errorService.log(error, ErrorCategory.GENERAL, 'Erro na transcrição de áudio.');
          addNotification('Erro ao transcrever áudio.', 'error');
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      addNotification('Gravando áudio...', 'info');
    } catch (error) {
      errorService.log(error, ErrorCategory.USER_INTERACTION, 'Erro ao acessar microfone.');
      addNotification('Erro ao acessar microfone. Verifique as permissões.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { activeKey: activeApiKey, keys, activeKeyId, setActiveKeyId } = useApiKey();

  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  const addDebugLog = (msg: string) => {
    setDebugLog(prev => [...prev.slice(-4), msg]);
  };

  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    try {
      const storedAccounts = JSON.parse(localStorage.getItem('jarvis_accounts') || '[]');
      setAccounts(storedAccounts);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const syncAuth = async () => {
      console.log('JARVIS: Verificando status de autenticação...');
      addDebugLog('Iniciando syncAuth...');
      try {
        const storedToken = localStorage.getItem('jarvis_auth_token');
        console.log('JARVIS: Token em localStorage:', !!storedToken);
        addDebugLog(`Token no localStorage: ${!!storedToken}`);
        
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const response = await fetch('/api/auth/status', { 
          credentials: 'include',
          headers
        });
        const data = await response.json();
        console.log('JARVIS: Status recebido:', data);
        addDebugLog(`Status recebido: auth=${data.isAuthenticated}, user=${!!data.user}`);
        
        if (data.isAuthenticated && data.user) {
          const normalizedUser = {
            ...data.user,
            uid: data.user.id, // Map id to uid for Supabase consistency
            displayName: data.user.name || data.user.displayName,
            photoURL: data.user.picture || data.user.photoURL
          };
          
          const allowedAdmins = [
            'admjesusia@gmail.com',
            'jesusmjunior2021@gmail.com',
            'martjesusmartins@gmail.com'
          ];
          const adminEmailEnv = (secrets.ADMIN_EMAIL || import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase();
          if (adminEmailEnv) {
            const emailsFromEnv = adminEmailEnv.split(',').map(e => e.trim());
            emailsFromEnv.forEach(email => {
              if (email && !allowedAdmins.includes(email)) {
                allowedAdmins.push(email);
              }
            });
          }

          const userEmail = normalizedUser.email?.toLowerCase();
          const isAuthorized = allowedAdmins.includes(userEmail || '');

          if (!isAuthorized) {
            console.warn('JARVIS: Acesso negado para:', normalizedUser.email);
            addDebugLog(`Acesso negado: ${normalizedUser.email} não está na lista de administradores.`);
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            setUser(null);
            addNotification(`Acesso restrito aos administradores autorizados.`, 'error');
            return false;
          } else {
            console.log('JARVIS: Acesso concedido.');
            addDebugLog('Acesso concedido!');
            setUser(normalizedUser);
            setIsGWorkspaceConnected(true);
            
            // Update accounts list
            if (storedToken) {
              setAccounts(prev => {
                const newAccounts = [...prev];
                const existingIndex = newAccounts.findIndex(a => a.email === normalizedUser.email);
                if (existingIndex >= 0) {
                  newAccounts[existingIndex] = { ...normalizedUser, token: storedToken };
                } else {
                  newAccounts.push({ ...normalizedUser, token: storedToken });
                }
                localStorage.setItem('jarvis_accounts', JSON.stringify(newAccounts));
                return newAccounts;
              });
            }
            
            return true;
          }
        } else {
          console.log('JARVIS: Usuário não autenticado ou tokens ausentes.');
          addDebugLog('Usuário não autenticado.');
          setUser(null);
          setIsGWorkspaceConnected(false);
          return false;
        }
      } catch (error: any) {
        errorService.log(error, ErrorCategory.AUTH, 'Falha ao sincronizar autenticação.');
        addDebugLog(`Erro no syncAuth: ${error.message}`);
        return false;
      } finally {
        setIsAuthReady(true);
      }
    };

    syncAuth();

    const handleOAuthSuccess = (event: MessageEvent) => {
      console.log('JARVIS DEBUG: Mensagem recebida da popup:', event.origin, event.data);
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        addDebugLog('Mensagem OAUTH_AUTH_SUCCESS recebida!');
        if (event.data.token) {
          console.log('JARVIS DEBUG: Token recebido, salvando no localStorage...');
          localStorage.setItem('jarvis_auth_token', event.data.token);
          addDebugLog('Token salvo no localStorage.');
        } else {
          console.warn('JARVIS DEBUG: Mensagem de sucesso recebida, mas sem token!');
          addDebugLog('Aviso: Mensagem sem token!');
        }
        console.log('JARVIS DEBUG: Autenticação OAuth bem-sucedida, sincronizando em 1s...');
        
        // Use a retry mechanism to ensure the session is picked up
        let retries = 0;
        const maxRetries = 3;
        
        const trySync = async () => {
          console.log(`JARVIS DEBUG: Tentativa de sincronização ${retries + 1}/${maxRetries}...`);
          addDebugLog(`Tentativa de sync ${retries + 1}/${maxRetries}...`);
          const success = await syncAuth();
          if (!success && retries < maxRetries) {
            retries++;
            console.log(`JARVIS DEBUG: Tentativa de sincronização ${retries}/${maxRetries} falhou, tentando novamente em 1.5s...`);
            setTimeout(trySync, 1500);
          } else if (success) {
            console.log('JARVIS DEBUG: Sincronização bem-sucedida após OAuth!');
            addDebugLog('Sincronização bem-sucedida!');
          }
        };

        setTimeout(trySync, 1000);
      }
    };
    window.addEventListener('message', handleOAuthSuccess);
    return () => window.removeEventListener('message', handleOAuthSuccess);
  }, []);

  const handleLogin = async () => {
    try {
      showNotification('Iniciando conexão com Google...');
      const response = await fetch('/api/auth/url', { credentials: 'include' });
      const data = await response.json();
      
      if (response.status === 500 && data.error === "Configuração de OAuth ausente") {
        showNotification('Configuração incompleta: OAUTH_CLIENT_ID ou SECRET não definidos no AI Studio.', 'error');
        addDebugLog('ERRO: OAuth não configurado no servidor.');
        return;
      }

      if (data.url) {
        const popup = window.open(data.url, 'oauth_popup', 'width=600,height=700');
        if (!popup) {
          showNotification('Popup bloqueado pelo navegador. Por favor, clique no botão para conectar.', 'error');
        }
      } else {
        showNotification('Erro: URL de login não recebida.', 'error');
      }
    } catch (error) {
      errorService.log(error, ErrorCategory.AUTH, 'Não foi possível iniciar o login com o Google.');
      showNotification('Erro de conexão com o servidor de autenticação.', 'error');
    }
  };

  useEffect(() => {
    if (isAuthReady && !user) {
      // Tenta iniciar o login automaticamente apenas se não houver contas salvas
      const storedAccounts = JSON.parse(localStorage.getItem('jarvis_accounts') || '[]');
      if (storedAccounts.length === 0) {
        handleLogin();
      }
    }
  }, [isAuthReady, user]);

  const [settingsTab, setSettingsTab] = useState<'general' | 'storage' | 'metadata' | 'hashnode' | 'supabase'>('general');
  const [hashnodeToken, setHashnodeToken] = useState('');
  const [hashnodeWebhook, setHashnodeWebhook] = useState('');

  useEffect(() => {
    setHashnodeToken(localStorage.getItem('hashnodeToken') || '');
    setHashnodeWebhook(localStorage.getItem('hashnodeWebhook') || '');
  }, []);

  const handleLogout = async () => {
    try {
      const storedToken = localStorage.getItem('jarvis_auth_token');
      const headers: HeadersInit = { 'credentials': 'include' } as any;
      if (storedToken) {
        (headers as any)['Authorization'] = `Bearer ${storedToken}`;
      }
      
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include',
        headers: headers as any
      });
      
      localStorage.removeItem('jarvis_auth_token');
      setUser(null);
      setIsGWorkspaceConnected(false);
      showNotification('Sessão encerrada.');
    } catch (error) {
      errorService.log(error, ErrorCategory.AUTH, 'Erro ao encerrar sessão.');
    }
  };

  const togglePersistenceMode = () => {
    const newMode = storageConfig.mode === 'memory' ? 'local' : 'memory';
    // This is now handled by the new storage buttons, but keeping for compatibility if needed
    addNotification(`Persistência alterada para: ${newMode === 'local' ? 'Storage Local' : 'Cache em Memória'}`);
  };

/*
  useEffect(() => {
    if (user && isAuthReady) {
      const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          // Check if expired
          if (new Date(data.key_expires_at) < new Date()) {
            showNotification('Sua chave de API Gemini expirou. Por favor, atualize-a.');
          }
        }
      }, (error) => {
        errorService.log(error, ErrorCategory.DATABASE, `Erro ao carregar configurações: settings/${user.uid}`);
      });
      return () => unsubscribe();
    }
  }, [user, isAuthReady]);
*/

  useEffect(() => {
    if (user && isAuthReady && isSupabaseConnected) {
      const loadCards = async () => {
        try {
          const res = await apiFetch(`/api/db/cards/${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            setCards(data);
          }
        } catch (error) {
          console.error('Erro ao carregar notas do Supabase:', error);
        }
      };
      loadCards();
    }
  }, [user, isAuthReady, isSupabaseConnected]);

  // Periodic Sync (Every 5 minutes)
  useEffect(() => {
    if (user && isAuthReady && isSupabaseConnected) {
      // Initial sync
      syncService.syncAll(user.uid, setSyncProgress).then(result => {
        if (result.success) {
          console.log('JARVIS: Sincronização inicial concluída.');
          memoryService.getSessions(user.uid).then(setSessions);
        }
        setTimeout(() => setSyncProgress(null), 2000);
      });

      const interval = setInterval(() => {
        console.log('JARVIS: Iniciando sincronização periódica (5min)...');
        syncService.syncAll(user.uid, setSyncProgress).then(result => {
          if (result.success) {
            addNotification('Sincronização automática concluída.', 'success');
            memoryService.getSessions(user.uid).then(setSessions);
          }
          setTimeout(() => setSyncProgress(null), 2000);
        });
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user, isAuthReady, isSupabaseConnected]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (user && isAuthReady) {
      const loadSessions = async () => {
        const userSessions = await memoryService.getSessions(user.uid);
        setSessions(userSessions);
        if (userSessions.length > 0) {
          const latestSession = userSessions[0];
          setCurrentSessionId(latestSession.id);
          const history = await memoryService.getSessionMessages(user.uid, latestSession.id);
          const formattedHistory: Message[] = history.map(h => ({
            id: h.id || Date.now().toString(),
            role: h.role as 'user' | 'assistant',
            content: h.content,
            timestamp: h.timestamp
          }));
          setMessages(formattedHistory);
        } else {
          startNewChat();
        }
      };
      loadSessions();
    }
  }, [user, isAuthReady]);

  const handleFeedback = async (messageId: string, type: 'positive' | 'negative') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback: type } : msg
    ));
    
    if (user) {
      try {
        // await setDoc(doc(db, `users/${user.uid}/feedback`, messageId), {
        //   messageId,
        //   type,
        //   timestamp: Date.now()
        // });
        console.log("Mocked save feedback:", messageId, type);
        showNotification(`Feedback ${type === 'positive' ? 'positivo' : 'negativo'} registrado.`);
      } catch (error) {
        console.error('Erro ao salvar feedback:', error);
      }
    }
  };

  const archiveMessage = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isArchived: true } : msg
    ));
    showNotification('Mensagem arquivada.');
  };

  const endSession = async () => {
    if (!user || !currentSessionId) return;
    try {
      await memoryService.save(user.uid, {
        sessionId: currentSessionId,
        role: 'system',
        content: `--- SESSÃO ENCERRADA: ${new Date().toLocaleString()} ---`,
        timestamp: Date.now()
      });
      setMessages([]);
      setCurrentSessionId(null);
      showNotification('Sessão encerrada e arquivada na memória.');
    } catch (error) {
      errorService.log(error, ErrorCategory.DATABASE, 'Erro ao encerrar sessão.');
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    showNotification('Nova sessão iniciada.');
  };

  const deleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    showNotification('Mensagem excluída.');
  };

  const handleExport = () => user && exportMemory(user.uid);
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      try {
        await importMemory(user.uid, file);
        showNotification('Memória importada com sucesso!');
        const userSessions = await memoryService.getSessions(user.uid);
        setSessions(userSessions);
      } catch (error) {
        errorService.log(error, ErrorCategory.USER_INTERACTION, 'Erro ao importar memória.');
      }
    }
  };

/*
  // Listen for task updates (HITL)
  useEffect(() => {
    if (user && isAuthReady) {
      const q = query(collection(db, 'tasks'), where('uid', '==', user.uid), where('status', '==', 'PENDING'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const task = change.doc.data();
            showNotification(`Aprovação necessária: ${task.action}`);
          }
        });
      }, (error) => {
        errorService.log(error, ErrorCategory.DATABASE, 'Erro ao carregar tarefas.');
      });
      return () => unsubscribe();
    }
  }, [user, isAuthReady]);
*/

  const showNotification = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    addNotification(msg, type);
  };

  const handleApproval = async (taskId: string, approved: boolean) => {
    try {
      // await setDoc(doc(db, 'tasks', taskId), {
      //   status: approved ? 'APPROVED' : 'CANCELLED'
      // }, { merge: true });
      console.log("Mocked update task status:", taskId, approved);

      setMessages(prev => prev.map(msg => 
        msg.taskId === taskId ? { ...msg, content: approved ? 'Ação aprovada pelo usuário. Executando...' : 'Ação cancelada pelo usuário.' } : msg
      ));

      if (approved) {
        showNotification('Ação aprovada. JESUS I.A. retomando...');
        
        // Fetch task details to execute
        // const taskSnap = await getDoc(doc(db, 'tasks', taskId));
        // if (taskSnap.exists()) {
        //   const task = taskSnap.data();
        //   const result = await executeToolCall(task.action, task.details);
        //   
        //   setMessages(prev => [...prev, {
        //     id: `sys-${Date.now()}`,
        //     role: 'assistant',
        //     content: `[SISTEMA] ${result.message}`,
        //     timestamp: Date.now(),
        //     isSystem: true
        //   }]);
        // }
        console.log("Mocked execute tool call for task:", taskId);
      }
    } catch (error) {
      errorService.log(error, ErrorCategory.USER_INTERACTION, 'Erro ao processar aprovação.');
    }
  };

  const executeToolCall = async (name: string, args: any) => {
    try {
      let endpoint = '';
      let body = args;

      switch (name) {
        case 'gmail_list':
          endpoint = '/api/tools/gmail/list';
          break;
        case 'gmail_get_message':
          endpoint = '/api/tools/gmail/get';
          break;
        case 'calendar_list':
          endpoint = '/api/tools/calendar/list';
          break;
        case 'tasks_list':
          endpoint = '/api/tools/tasks/list';
          break;
        case 'gmail_send':
          endpoint = '/api/tools/gmail/send';
          break;
        case 'calendar_create':
          endpoint = '/api/tools/calendar/create';
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
        case 'youtube_search':
          endpoint = '/api/tools/youtube/search';
          break;
        case 'map_save':
          const newMap = {
            id: Math.random().toString(36).substring(7),
            title: args.title,
            markers: args.markers,
            route: args.route,
            timestamp: Date.now()
          };
          setMaps(prev => [...prev, newMap]);
          if (user) {
            syncService.addToQueue('maps', { ...newMap, uid: user.uid });
            apiFetch('/api/db/maps', {
              method: 'POST',
              body: JSON.stringify({ ...newMap, uid: user.uid })
            }).catch(err => console.warn('Falha no salvamento imediato do mapa:', err));
          }
          return { success: true, message: "Mapa salvo com sucesso." };
        case 'sheets_update':
          endpoint = '/api/tools/sheets/update';
          break;
        case 'tasks_create':
          endpoint = '/api/tools/tasks/create';
          break;
        case 'contacts_search':
          endpoint = '/api/tools/contacts/search';
          break;
        case 'mari_research':
          // 1. Check if another generation is active
          if (activeGenerations.length > 0) {
            return { 
              success: false, 
              message: "Já existe uma geração em andamento. Por favor, aguarde a conclusão do artigo atual antes de iniciar outro." 
            };
          }

          // 2. Check if theme already exists
          const existingReports = await getReports();
          const themeExists = existingReports.some(r => r.title.toLowerCase().includes(args.query.toLowerCase()));
          if (themeExists) {
            addNotification(`Nota: Já existe um artigo sobre "${args.query}". Gerando uma nova versão...`, 'info');
          }

          const genId = Date.now().toString();
          const controller = new AbortController();
          setActiveGenerations(prev => [...prev, { id: genId, query: args.query, progress: 0, abortController: controller }]);
          addTask(genId, `Pesquisando: ${args.query}`);
          
          // Progress simulation
          const progressInterval = setInterval(() => {
            setActiveGenerations(prev => {
              const updated = prev.map(g => g.id === genId ? { ...g, progress: Math.min(g.progress + 5, 95) } : g);
              // Update backgroundTasks based on the new progress
              const task = updated.find(g => g.id === genId);
              if (task) updateTaskProgress(genId, task.progress);
              return updated;
            });
          }, 1000);

          try {
            const report = await protocoloMariResearch(args.query, (p) => {
              const progress = Math.round(p * 100);
              setActiveGenerations(prev => {
                const updated = prev.map(g => g.id === genId ? { ...g, progress } : g);
                updateTaskProgress(genId, progress);
                return updated;
              });
            }, activeApiKey || "");
            clearInterval(progressInterval);
            setActiveGenerations(prev => prev.filter(g => g.id !== genId));
            removeTask(genId);
            
            // Auto-archive the report
            await archiveReport(report);
            
            // Show notification and open report
            addNotification(`Artigo "${args.query}" concluído!`, 'success');
            setActiveReport(report);
            setShowRevista(true);

            return {
              success: true,
              message: `Artigo científico sobre "${args.query}" gerado com sucesso no Protocolo Mari.`,
              data: { report }
            };
          } catch (error: any) {
            clearInterval(progressInterval);
            setActiveGenerations(prev => prev.filter(g => g.id !== genId));
            removeTask(genId);
            if (error.name === 'AbortError' || error.message === 'Aborted') {
              return { success: false, message: "Geração do artigo cancelada." };
            }
            throw error;
          }
        default:
          throw new Error(`Tool ${name} not implemented`);
      }

      const storedToken = localStorage.getItem('jarvis_auth_token');
      const headers: any = { 
        'Content-Type': 'application/json'
      };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        return { 
          success: true, 
          message: result.message || "Operação concluída com sucesso.",
          data: result
        };
      } else {
        throw new Error(result.error || "Erro na execução da ferramenta.");
      }
    } catch (error: any) {
      errorService.log(error, ErrorCategory.SYSTEM, `Erro ao executar ferramenta: ${name}`);
      return { success: false, message: `Erro: ${error.message}` };
    }
  };

  useEffect(() => {
    const checkGWorkspaceStatus = async () => {
      try {
        const storedToken = localStorage.getItem('jarvis_auth_token');
        const headers: any = { 'credentials': 'include' };
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }

        const response = await fetch('/api/auth/status', { 
          credentials: 'include',
          headers
        });
        const data = await response.json();
        setIsGWorkspaceConnected(data.isAuthenticated);
      } catch (error) {
        errorService.log(error, ErrorCategory.API, 'Erro ao verificar status do Google Workspace.');
      }
    };
    checkGWorkspaceStatus();

    // Removed redundant handleOAuthMessage listener here as it's handled by the main syncAuth listener
  }, []);

  const connectGWorkspace = async () => {
    try {
      const response = await fetch('/api/auth/url', { credentials: 'include' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao obter URL de autenticação');
      }
      
      if (data.url) {
        window.open(data.url, 'oauth_popup', 'width=600,height=700');
      } else {
        throw new Error('URL de autenticação não fornecida');
      }
    } catch (error: any) {
      errorService.log(error, ErrorCategory.API, 'Erro ao conectar com Google Workspace.');
      showNotification(error.message || 'Erro ao iniciar conexão com Google Workspace.');
    }
  };

  const disconnectGWorkspace = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('jarvis_auth_token');
      setIsGWorkspaceConnected(false);
      showNotification('Google Workspace desconectado com sucesso.', 'success');
    } catch (error) {
      errorService.log(error, ErrorCategory.API, 'Erro ao desconectar Google Workspace.');
      showNotification('Erro ao desconectar Google Workspace.', 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsLoading(true);
        // Upload to Supabase Storage
        const filePath = await storageService.uploadFile(file, { type: 'document', originalName: file.name });
        
        if (file.type === 'application/pdf') {
          const text = await extractTextFromPDF(file);
          setSelectedFileContent(text);
          showNotification(`PDF "${file.name}" processado e salvo com sucesso.`);
        } else {
          showNotification(`Arquivo "${file.name}" salvo com sucesso.`);
        }
      } catch (error) {
        errorService.log(error, ErrorCategory.GENERAL, 'Erro ao processar e salvar arquivo.');
        showNotification('Erro ao processar arquivo.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsLoading(true);
        // Upload to Supabase Storage
        const filePath = await storageService.uploadFile(file, { type: 'image', originalName: file.name });
        
        // Read locally for preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
        
        showNotification(`Imagem "${file.name}" salva com sucesso.`);
      } catch (error) {
        errorService.log(error, ErrorCategory.GENERAL, 'Erro ao salvar imagem.');
        showNotification('Erro ao salvar imagem.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleQuickModeClick = (mode: QuickMode) => {
    let query = input.trim();
    if (!query) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      query = lastUserMsg ? lastUserMsg.content : "documentos recentes";
    }

    let prompt = "";
    switch (mode) {
      case 'drive':
        prompt = `[MODO DRIVE] Por favor, execute uma pesquisa no Google Drive por: "${query}". Exiba os resultados em formato de lista.`;
        break;
      case 'youtube':
        prompt = `[MODO YOUTUBE] Por favor, execute uma pesquisa no YouTube por: "${query}". Exiba os resultados em formato de lista.`;
        break;
      case 'tasks':
        prompt = `[MODO TAREFAS] Por favor, adicione uma tarefa relacionada a: "${query}". Peça os detalhes (como data de vencimento ou notas) se necessário.`;
        break;
      case 'calendar':
        prompt = `[MODO CALENDÁRIO] Por favor, adicione um evento no calendário sobre: "${query}". Peça os detalhes (data/hora de início e fim) se necessário.`;
        break;
      case 'revista':
        prompt = `[MODO REVISTA] Por favor, gere uma reportagem sobre: "${query}", seguindo o protocolo MARE e apresentando em formato de revista eletrônica. Pesquise informações relevantes e formate como um artigo completo.`;
        break;
      case 'docs':
        prompt = `[MODO DOCUMENTOS] Por favor, crie ou edite um documento no Google Docs sobre: "${query}". Peça os detalhes do conteúdo se necessário.`;
        break;
      case 'sheets':
        prompt = `[MODO PLANILHAS] Por favor, crie ou edite uma planilha no Google Sheets sobre: "${query}". Peça os detalhes dos dados se necessário.`;
        break;
    }
    
    setActiveQuickMode(mode);
    sendMessage(prompt);
    setTimeout(() => setActiveQuickMode(null), 3000);
  };

  const sendMessage = async (text?: string) => {
    let messageText = text || input;
    if ((!messageText.trim() && !selectedImage && !selectedFileContent) || isLoading) return;

    // Card creation detection
    if (messageText.toLowerCase().startsWith("gera um card")) {
      const cardContent = messageText.replace(/gera um card/i, '').trim();
      addCard({
        id: Date.now().toString(),
        type: 'note',
        title: 'Novo Card',
        content: cardContent,
        timestamp: Date.now(),
        color: '#ffffff',
        isCollapsed: false,
        isPinned: false
      });
      showNotification("Card criado com sucesso.");
      if (!text) setInput('');
      return;
    }

    let activeSessionId = currentSessionId;
    if (!activeSessionId && user) {
      activeSessionId = Date.now().toString();
      setCurrentSessionId(activeSessionId);
      const newSession: ChatSession = {
        id: activeSessionId,
        uid: user.uid,
        title: 'Nova Conversa',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false
      };
      setSessions(prev => [newSession, ...prev]);
      await memoryService.saveSessionMetadata(user.uid, newSession);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText + (selectedFileContent ? `\n\nConteúdo do arquivo:\n${selectedFileContent}` : ''),
      image: selectedImage || undefined,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!text) setInput('');
    setSelectedFileContent(null);
    setSelectedImage(null);
    setIsLoading(true);

    // Detect if search is likely
    const isSearchIntent = messageText.toLowerCase().includes('pesquise') || messageText.toLowerCase().includes('busque') || messageText.toLowerCase().includes('procure') || messageText.toLowerCase().includes('youtube') || messageText.toLowerCase().includes('mari');
    
    if (isSearchIntent && !isNoteApproved) {
      setIsLoading(false);
      showNotification('Por favor, crie e aprove uma nota antes de realizar uma pesquisa.', 'error');
      return;
    }

    if (isSearchIntent) {
      setSearchProgress({ active: true, query: messageText, progress: 10 });
      const interval = setInterval(() => {
        setSearchProgress(prev => ({ ...prev, progress: Math.min(prev.progress + 5, 95) }));
      }, 500);
      setTimeout(() => clearInterval(interval), 10000);
    }

    try {
      if (user && activeSessionId) {
        await memoryService.save(user.uid, {
          sessionId: activeSessionId,
          role: 'user',
          content: messageText,
          timestamp: Date.now()
        });
      }

      let imageParts: any[] = [];
      if (selectedImage) {
        const base64Data = selectedImage.split(',')[1];
        const mimeType = selectedImage.split(';')[0].split(':')[1];
        imageParts.push({
          inlineData: {
            data: base64Data,
            mimeType
          }
        });
        setSelectedImage(null);
      }

      // Live Search Logic
      if (messageText.toLowerCase().includes('pesquise') || messageText.toLowerCase().includes('busque')) {
        showNotification('JESUS I.A.: Iniciando busca em tempo real...');
        setSearchProgress({ active: true, query: 'Iniciando busca...', progress: 20 });
      }

      // Get search history for context
      const searchContext = user ? await searchService.getSearchContext(user.uid) : "";
      const dynamicSystemInstruction = `${jarvisSystemInstruction}\n\n${searchContext}\n\nSTATUS ATUAL DO USUÁRIO:\n- Autenticado: ${!!user}\n- Conectado ao Google Workspace: ${!!user?.email}\n- E-mail: ${user?.email || 'Não disponível'}\n\nSe o usuário pedir para fazer algo no Workspace ou YouTube e estiver conectado, USE AS FERRAMENTAS REAIS. Não simule.`;

      // Try sending with active key, if it fails with quota, try other keys
      let response;
      let usedKey = activeApiKey || "";
      
      try {
        response = await getGeminiResponse(userMessage.content, usedKey, dynamicSystemInstruction, imageParts);
      } catch (error: any) {
        const errorMsg = error.message || "";
        if ((errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) && keys.length > 1) {
          console.warn("JARVIS: Chave ativa esgotada. Tentando rotação de chaves...");
          const otherKeys = keys.filter(k => k.id !== activeKeyId && k.status !== "error" && k.status !== "quota_exceeded");
          
          if (otherKeys.length > 0) {
            // Try the first available other key
            const nextKeyRecord = otherKeys[0];
            const nextKey = atob(nextKeyRecord.key || "");
            if (nextKey) {
              showNotification(`JARVIS: Chave esgotada. Alternando para "${nextKeyRecord.name}"...`);
              response = await getGeminiResponse(userMessage.content, nextKey, dynamicSystemInstruction, imageParts);
              // Update active key for future messages
              setActiveKeyId(nextKeyRecord.id);
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      
      // Handle grounding metadata (Google Search)
      const groundingMetadata = (response as any).candidates?.[0]?.groundingMetadata;
      let searchResults: SearchResult[] = [];
      
      if (groundingMetadata?.groundingChunks) {
        setSearchProgress(prev => ({ ...prev, progress: 100 }));
        setTimeout(() => setSearchProgress({ active: false, query: '', progress: 0 }), 1000);
        
        searchResults = groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
          .map((chunk: any) => ({
            title: chunk.web.title,
            link: chunk.web.uri,
            source: new URL(chunk.web.uri).hostname,
            summary: "Fonte real identificada pelo Vertex AI Engine para consulta estruturada.",
            type: 'web'
          }));
          
        if (searchResults.length > 0 && user) {
          searchService.saveSearch(user.uid, {
            query: messageText,
            type: 'web',
            results: searchResults,
            summary: `Busca web realizada durante a conversa sobre "${messageText.substring(0, 30)}..."`,
            sessionId: activeSessionId || undefined
          });
        }
      } else {
        setSearchProgress({ active: false, query: '', progress: 0 });
      }

      // Handle Function Calling
      const functionCalls = response.functionCalls;
      console.log('JARVIS: Function Calls detectadas:', functionCalls);
      
      if (functionCalls && functionCalls.length > 0) {
        const plan: Plan = {
          steps: functionCalls.map(call => ({ action: call.name, details: call.args })),
          estimatedTokens: "~500 tokens" // Mock estimation
        };

        const approval = checkApprovalRequired(plan);

        if (approval.status === 'PENDING_USER') {
          const taskRefId = Date.now().toString();
          console.log("Mocked add task:", taskRefId);

          setMessages(prev => [...prev, {
            id: `approval-${Date.now()}`,
            role: 'assistant',
            content: approval.message,
            timestamp: Date.now(),
            isApproval: true,
            taskId: taskRefId
          }]);
          setIsLoading(false);
          return;
        }

        // If no approval needed, proceed
        for (const call of functionCalls) {
          setSearchProgress({ active: true, query: `Executando: ${call.name}...`, progress: 50 });
          const result = await executeToolCall(call.name, call.args);
          
          if (result.success) {
            if (['youtube_search', 'drive_search', 'googleSearch'].includes(call.name)) {
              addNotification(`Pesquisa concluída: ${call.name}`, 'success');
            }
            showNotification(result.message);
            if (call.name === 'youtube_search' && result.data.videos) {
              setRecentVideos(prev => {
                const newVideos = [...result.data.videos, ...prev];
                // Remove duplicates by ID and limit to 10
                return Array.from(new Map(newVideos.map(v => [v.id, v])).values()).slice(0, 10);
              });

              if (user) {
                const query = (call.args as any).query || 'Busca';
                searchService.saveSearch(user.uid, {
                  query,
                  type: 'youtube',
                  results: result.data.videos,
                  summary: `Busca no YouTube por "${query}"`,
                  sessionId: activeSessionId || undefined
                });
              }
            }
            
            setMessages(prev => [...prev, {
              id: `sys-${Date.now()}`,
              role: 'assistant',
              content: `[SISTEMA] ${result.message}`,
              timestamp: Date.now(),
              isSystem: true,
              toolResult: result.data
            }]);
          } else {
            showNotification(result.message);
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Processamento concluído.',
        timestamp: Date.now(),
        searchResults: searchResults.length > 0 ? searchResults : undefined
      };

      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        
        // Generate metadata if it's the first exchange
        if (user && activeSessionId && newMessages.length <= 2) {
          memoryService.generateSessionMetadata(
            newMessages.map(m => ({ role: m.role, content: m.content, uid: user.uid, timestamp: m.timestamp })),
            activeApiKey || ''
          ).then(metadata => {
            setSessions(currentSessions => currentSessions.map(s => 
              s.id === activeSessionId ? { ...s, title: metadata.title, tags: metadata.tags, updatedAt: Date.now() } : s
            ));
            memoryService.saveSessionMetadata(user.uid, {
              id: activeSessionId!,
              uid: user.uid,
              title: metadata.title,
              tags: metadata.tags,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isPinned: false
            });
          });
        }
        return newMessages;
      });

      if (user && activeSessionId) {
        await memoryService.save(user.uid, {
          sessionId: activeSessionId,
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      errorService.log(error, ErrorCategory.USER_INTERACTION, 'Erro ao enviar mensagem para o JARVIS.');
      
      // Add error message to chat if it's a 429
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: "⚠️ **Limite de Cota Excedido**: O JESUS I.A. atingiu o limite de requisições gratuitas. Por favor, aguarde cerca de 1 minuto ou configure sua própria API Key nas configurações para uso ilimitado.",
          timestamp: Date.now(),
          isSystem: true
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <>
        <ToastContainer />
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-emerald-500">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <ToastContainer />
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center space-y-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
              <Bot className="w-24 h-24 mx-auto text-emerald-500 relative z-10" />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter">JESUS I.A. 360°</h1>
            <p className="text-zinc-400 text-lg">Seu agente hierárquico goal-based com autonomia real.</p>
            
            {accounts.length > 0 && (
              <div className="space-y-3 text-left bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-center mb-4">Contas Prelogadas</p>
                {accounts.map((acc, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      localStorage.setItem('jarvis_auth_token', acc.token);
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                  >
                    <img src={acc.photoURL} alt={acc.displayName} className="w-10 h-10 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{acc.displayName}</p>
                      <p className="text-xs text-zinc-400 truncate">{acc.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button 
              onClick={handleLogin}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 transition-colors rounded-2xl font-semibold text-lg shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <User className="w-5 h-5" />
              {accounts.length > 0 ? 'Conectar com outra conta' : 'Conectar com Google'}
            </button>
            <button 
              onClick={() => {
                addDebugLog('Sincronização manual...');
                window.location.reload();
              }}
              className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-xl font-medium text-sm text-zinc-300"
            >
              Recarregar Página
            </button>
            
            {/* Debug Overlay */}
            <div className="mt-8 p-4 bg-black/50 rounded-xl border border-white/10 text-left">
              <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2">Debug Log</h3>
              <div className="space-y-1 font-mono text-xs text-zinc-400">
                {debugLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
                {debugLog.length === 0 && <div>Aguardando eventos...</div>}
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white font-sans">
      <ToastContainer />
      
      {/* Sync Progress Overlay */}
      <AnimatePresence>
        {syncProgress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-8 right-8 z-[100] bg-zinc-900/90 backdrop-blur-xl border border-purple-500/30 p-4 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.2)] w-72"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${
                  syncProgress.type === 'upload' ? 'bg-purple-500/20 text-purple-400' : 
                  syncProgress.type === 'download' ? 'bg-cyan-500/20 text-cyan-400' : 
                  'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {syncProgress.type === 'upload' ? <CloudUpload className="w-4 h-4" /> : 
                   syncProgress.type === 'download' ? <CloudDownload className="w-4 h-4" /> : 
                   <RefreshCw className={`w-4 h-4 ${syncProgress.status !== 'completed' ? 'animate-spin' : ''}`} />}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {syncProgress.status === 'syncing' ? 'Enviando' : 
                   syncProgress.status === 'pulling' ? 'Recebendo' : 
                   syncProgress.status === 'completed' ? 'Concluído' : 'Sincronizando'}
                </span>
              </div>
              <span className="text-[10px] font-mono text-purple-400">{syncProgress.progress}%</span>
            </div>
            
            <p className="text-[11px] text-zinc-300 mb-3 truncate">{syncProgress.message}</p>
            
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${syncProgress.progress}%` }}
                className={`h-full shadow-[0_0_10px_rgba(168,85,247,0.5)] ${
                  syncProgress.status === 'error' ? 'bg-red-500' : 'bg-purple-500'
                }`}
              />
            </div>
            
            {syncProgress.status === 'completed' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-400 font-medium"
              >
                <CheckCircle2 className="w-3 h-3" />
                Banco de dados sincronizado com sucesso
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/20"
          >
            <Bell className="w-5 h-5 animate-bounce" />
            <span className="font-medium">{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {activeDashboard === 'chat' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {backgroundTasks.length > 0 && (
              <div className="absolute top-0 left-0 w-full z-50 bg-zinc-950/40 backdrop-blur-md p-3 border-b border-white/5 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em]">Tarefas em Segundo Plano</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {backgroundTasks.map(task => (
                    <div key={task.id} className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] text-zinc-300 font-medium truncate max-w-[150px]">{task.title}</span>
                        <span className="text-[10px] font-mono text-cyan-400">{task.progress}%</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress}%` }}
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_rgba(34,211,238,0.3)]" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        {/* Header */}
        <header className={`glass-header ${isAppHeaderCollapsed ? 'h-12' : 'h-20'} flex items-center justify-between px-8 sticky top-0 z-40 transition-all duration-500`}>
          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer" onClick={() => setActiveDashboard('chat')}>
              <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full group-hover:bg-cyan-500/40 transition-all duration-700" />
              <div className="relative flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                </div>
                {!isAppHeaderCollapsed && (
                  <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter text-white leading-none">JESUS I.A.</span>
                  </div>
                )}
              </div>
            </div>

            {!isAppHeaderCollapsed && (
              <div className="flex items-center gap-2 ml-4">
                <button 
                  onClick={startNewChat}
                  className="p-2.5 bg-white/5 hover:bg-cyan-500/10 text-zinc-400 hover:text-cyan-400 border border-white/10 rounded-xl transition-all group relative"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/90 text-[8px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50">
                    Novo Chat
                  </span>
                </button>
                <button 
                  onClick={async () => {
                    if (user) {
                      const result = await syncService.syncAll(user.uid, setSyncProgress);
                      addNotification(result.message, result.success ? 'success' : 'error');
                      setTimeout(() => setSyncProgress(null), 2000);
                    }
                  }}
                  className="p-2.5 bg-white/5 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 border border-white/10 rounded-xl transition-all group relative"
                >
                  <Save className="w-4 h-4" />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/90 text-[8px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50">
                    Salvar Workspace
                  </span>
                </button>
              </div>
            )}
            
            <button 
              onClick={() => setIsAppHeaderCollapsed(!isAppHeaderCollapsed)}
              className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-all"
              title={isAppHeaderCollapsed ? "Expandir" : "Recolher"}
            >
              {isAppHeaderCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-6">
            {searchProgress.active && (
              <div className="flex items-center gap-4 px-5 py-2 bg-zinc-900/50 border border-cyan-500/20 rounded-2xl backdrop-blur-md">
                <Search className="w-4 h-4 text-cyan-500 animate-pulse" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest truncate max-w-[150px]">
                    Buscando: {searchProgress.query}
                  </span>
                  <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${searchProgress.progress}%` }}
                      className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowLiveMode(true)}
                className="p-3 hover:bg-cyan-500/10 rounded-2xl text-zinc-400 hover:text-cyan-400 transition-all group relative"
              >
                <Mic className="w-6 h-6" />
                <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-[10px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl">
                  Modo Presença
                </span>
              </button>
              <button 
                onClick={() => setShowSearchLibrary(true)}
                className="p-3 hover:bg-purple-500/10 rounded-2xl text-zinc-400 hover:text-purple-400 transition-all group relative"
              >
                <Search className="w-6 h-6" />
                <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-[10px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl">
                  Conhecimento
                </span>
              </button>
              <button 
                onClick={() => setShowMemory(true)}
                className="p-3 hover:bg-yellow-500/10 rounded-2xl text-zinc-400 hover:text-yellow-400 transition-all group relative"
              >
                <Database className="w-6 h-6" />
                <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-[10px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl">
                  Memória Ativa
                </span>
              </button>
              <button 
                onClick={async () => {
                  if (user) {
                    const result = await syncService.syncAll(user.uid, setSyncProgress);
                    addNotification(result.message, result.success ? 'success' : 'error');
                    setTimeout(() => setSyncProgress(null), 2000);
                  }
                }}
                className="p-3 hover:bg-purple-500/10 rounded-2xl text-zinc-400 hover:text-purple-400 transition-all group relative"
              >
                <RefreshCw className={`w-6 h-6 ${syncProgress ? 'animate-spin text-purple-400' : ''}`} />
                <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/90 text-[10px] font-bold text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl">
                  Sincronizar Agora
                </span>
              </button>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex items-center gap-4 relative">
              <div 
                className="text-right hidden lg:block cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              >
                <p className="text-sm font-black text-white leading-none mb-1">{user?.displayName}</p>
                <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest">Arquiteto Alpha</p>
              </div>
              <NotificationBell tasks={backgroundTasks} />
              <button 
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                <img 
                  src={user?.photoURL} 
                  alt="Avatar" 
                  className="relative w-11 h-11 rounded-2xl border border-white/10 object-cover" 
                />
                <div className="absolute -bottom-1 -right-1 bg-zinc-950 rounded-full p-1 border border-white/10 shadow-xl">
                  <ChevronDown className="w-3 h-3 text-cyan-500" />
                </div>
              </button>
            </div>
          </div>
        </header>
        
        <AnimatePresence>
          {showAccountDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-3 border-b border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Contas Conectadas</p>
                        <button 
                          onClick={() => {
                            setShowAccountDropdown(false);
                            handleLogin();
                          }}
                          className="text-[10px] font-bold text-cyan-500 hover:text-cyan-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className="w-2 h-2" />
                          Trocar
                        </button>
                      </div>
                      <div className="space-y-1">
                        {accounts.map((acc, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              localStorage.setItem('jarvis_auth_token', acc.token);
                              window.location.reload();
                            }}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${acc.email === user?.email ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-white/5'}`}
                          >
                            <img src={acc.photoURL} alt={acc.displayName} className="w-8 h-8 rounded-full" />
                            <div className="text-left flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${acc.email === user?.email ? 'text-emerald-400' : 'text-zinc-300'}`}>{acc.displayName}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{acc.email}</p>
                            </div>
                            {acc.email === user?.email && <Check className="w-4 h-4 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-2">
                      <button 
                        onClick={() => {
                          setShowAccountDropdown(false);
                          handleLogin();
                        }}
                        className="w-full flex items-center gap-2 p-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Adicionar outra conta
                      </button>
                      <button 
                        onClick={() => {
                          setShowAccountDropdown(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 p-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair da conta atual
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

      {/* Video Player */}
      {activeVideo && (
        <VideoPlayer 
          url={activeVideo.url} 
          title={activeVideo.title} 
          onClose={() => setActiveVideo(null)} 
        />
      )}

      {/* Revista Eletrônica Full Screen */}
      <AnimatePresence>
        {showRevista && activeReport && (
          <RevistaEletronica 
            report={activeReport} 
            onClose={() => setShowRevista(false)} 
            addNotification={addNotification}
          />
        )}
      </AnimatePresence>

      {/* Revista Eletrônica Library */}
      <AnimatePresence>
        {showLibrary && (
          <RevistaEletronicaLibrary onClose={() => setShowLibrary(false)} />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-6 h-6 text-emerald-500" />
                  Configurações JESUS I.A.
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="flex border-b border-white/10 mb-6">
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${settingsTab === 'general' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  Geral
                </button>
                <button 
                  onClick={() => setSettingsTab('storage')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${settingsTab === 'storage' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  Armazenamento
                </button>
                <button 
                  onClick={() => setSettingsTab('metadata')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${settingsTab === 'metadata' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  Metadados
                </button>
                <button 
                  onClick={() => setSettingsTab('hashnode')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${settingsTab === 'hashnode' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  Hashnode
                </button>
                <button 
                  onClick={() => setSettingsTab('supabase')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${settingsTab === 'supabase' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  Supabase
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {settingsTab === 'general' && (
                  <>
                    <ApiKeyManager />
                    
                    <div className="pt-6 border-t border-white/10">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-emerald-500" />
                        Voz do Sistema
                      </h3>
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full bg-zinc-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                      >
                        <optgroup label="Vozes Neurais (Nuvem/Gemini)">
                          <option value="Kore">Kore (Feminina, Suave)</option>
                          <option value="Puck">Puck (Masculina, Amigável)</option>
                          <option value="Charon">Charon (Masculina, Profunda)</option>
                          <option value="Fenrir">Fenrir (Masculina, Forte)</option>
                          <option value="Zephyr">Zephyr (Feminina, Energética)</option>
                        </optgroup>
                        <optgroup label="Vozes Locais (Navegador)">
                          <option value="Francisca">Francisca (Microsoft Edge)</option>
                          <option value="Antonio">Antônio (Microsoft Edge)</option>
                          <option value="Nativo">Padrão do Navegador (Chrome/Safari)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-500" />
                        Google Workspace
                      </h3>
                      <div className="space-y-3">
                        {isGWorkspaceConnected ? (
                          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="w-5 h-5 text-emerald-500" />
                              <span className="text-sm font-medium text-white">Conectado</span>
                            </div>
                            <button 
                              onClick={disconnectGWorkspace}
                              className="text-[10px] font-bold text-zinc-500 uppercase hover:text-red-400 transition-colors"
                            >
                              Desconectar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={connectGWorkspace}
                            className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Database className="w-4 h-4" />
                            Conectar Google Workspace
                          </button>
                        )}
                        
                        <button 
                          onClick={async () => {
                            if (user) {
                              addNotification('Sincronizando Workspace...', 'info');
                              await persistenceService.syncWorkspace(user.uid);
                              addNotification('Workspace sincronizado.', 'success');
                            }
                          }}
                          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Sincronizar Agora
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {settingsTab === 'storage' && (
                  <div>
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-emerald-500" />
                        Banco de Dados Jarvis 360
                      </div>
                      <button 
                        onClick={async () => {
                          if (user) {
                            addNotification('Sincronizando...', 'info');
                            const result = await syncService.syncAll(user.uid);
                            if (result.success) {
                              addNotification('Sincronização concluída.', 'success');
                              memoryService.getSessions(user.uid).then(setSessions);
                            } else {
                              addNotification('Erro na sincronização.', 'error');
                            }
                          }
                        }}
                        className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 rounded-lg transition-colors"
                        title="Sincronizar agora"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </h3>
                    <div className="p-4 bg-zinc-800/50 border border-white/10 rounded-xl space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => {
                            const newConfig: StorageConfig = { ...storageConfig, mode: 'memory' };
                            setStorageConfig(newConfig);
                            storageService.setConfig(newConfig);
                            addNotification("Modo Memória ativado.", "success");
                          }}
                          className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${storageConfig.mode === 'memory' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'}`}
                        >
                          <Database className="w-4 h-4" />
                          <span className="text-[10px] font-bold">Memória</span>
                        </button>
                      </div>
                      
                      <div className="mt-6">
                        <Jarvis360 uid={user.uid} onSyncComplete={async () => {
                          const userSessions = await memoryService.getSessions(user.uid);
                          setSessions(userSessions);
                        }} />
                      </div>
                      
                      <div className="mt-6">
                        <GoogleProductivity uid={user.uid} />
                      </div>
                      
                      <div className="mt-6 flex gap-3">
                        <button 
                          onClick={() => user && persistenceService.exportAllData(user.uid)}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                          <Download className="w-4 h-4" />
                          Exportar Tudo
                        </button>
                        <button 
                          onClick={() => setShowCardLibrary(true)}
                          className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <Library className="w-4 h-4" />
                          Biblioteca
                        </button>
                      </div>
                      
                      <div className="text-[10px] text-zinc-500 italic leading-relaxed">
                        {storageConfig.mode === 'memory' && "Os dados serão perdidos ao fechar o navegador."}
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'metadata' && (
                  <MetadataManager />
                )}
                {settingsTab === 'hashnode' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white mb-4">Hashnode API</h3>
                    <input 
                      value={hashnodeToken}
                      onChange={(e) => {
                        setHashnodeToken(e.target.value);
                        localStorage.setItem('hashnodeToken', e.target.value);
                      }}
                      placeholder="Hashnode API Token"
                      className="w-full p-3 bg-zinc-800 rounded-xl border border-white/10 text-white text-sm"
                    />
                    <input 
                      value={hashnodeWebhook}
                      onChange={(e) => {
                        setHashnodeWebhook(e.target.value);
                        localStorage.setItem('hashnodeWebhook', e.target.value);
                      }}
                      placeholder="Hashnode Webhook URL"
                      className="w-full p-3 bg-zinc-800 rounded-xl border border-white/10 text-white text-sm"
                    />
                  </div>
                )}

                {settingsTab === 'supabase' && (
                  <div className="space-y-6">
                    <SupabaseConfigManager />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-12">
            </div>
          )}
          
          <AnimatePresence initial={false}>
            {messages.filter(m => !m.isArchived && !closedMessages.includes(m.id)).map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] transition-all ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600 text-white rounded-[2rem] rounded-tr-none p-6 shadow-2xl shadow-cyan-500/10' 
                    : msg.isSystem 
                      ? 'bg-zinc-900/40 text-cyan-400 border border-cyan-500/20 rounded-[2rem] rounded-tl-none p-6 italic text-sm backdrop-blur-md'
                      : msg.isApproval
                        ? 'bg-burnt-yellow/10 text-burnt-yellow border border-burnt-yellow/30 rounded-[2rem] rounded-tl-none p-6 backdrop-blur-md'
                        : 'glass-message rounded-tl-none'
                }`}>
                  {msg.isApproval ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 text-burnt-yellow font-black uppercase tracking-[0.2em] text-xs">
                        <ShieldAlert className="w-5 h-5" />
                        <span>Aprovação Necessária</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleApproval(msg.taskId!, true)}
                          className="flex-1 flex items-center justify-center gap-3 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] shadow-xl shadow-cyan-500/20"
                        >
                          <Check className="w-4 h-4" />
                          Aprovar
                        </button>
                        <button 
                          onClick={() => handleApproval(msg.taskId!, false)}
                          className="flex-1 flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-2xl transition-all font-black uppercase tracking-widest text-[10px]"
                        >
                          <X className="w-4 h-4" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="prose prose-invert max-w-none prose-sm font-medium leading-relaxed">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                      
                      {msg.role === 'assistant' && !msg.isSystem && !msg.isApproval && (
                        <div className="flex flex-col gap-6">
                          <TTSPlayer text={msg.content} apiKey={activeApiKey || ""} voiceName={selectedVoice} />
                          
                          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                            <button 
                              onClick={() => handleFeedback(msg.id, 'positive')}
                              className={`p-2 rounded-xl transition-all ${msg.feedback === 'positive' ? 'bg-cyan-500/20 text-cyan-500' : 'text-zinc-600 hover:text-cyan-500'}`}
                              title="Resposta Boa"
                            >
                              <ThumbsUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleFeedback(msg.id, 'negative')}
                              className={`p-2 rounded-xl transition-all ${msg.feedback === 'negative' ? 'bg-red-500/20 text-red-500' : 'text-zinc-600 hover:text-red-500'}`}
                              title="Resposta Ruim"
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </button>
                            <div className="flex-1" />
                            <button 
                              onClick={() => copyToClipboard(msg.content)}
                              className="p-2 text-zinc-600 hover:text-cyan-400 transition-all rounded-xl"
                              title="Copiar Conteúdo"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => closeMessage(msg.id)}
                              className="p-2 text-zinc-600 hover:text-burnt-yellow transition-all rounded-xl"
                              title="Fechar Card"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => archiveMessage(msg.id)}
                              className="p-2 text-zinc-600 hover:text-blue-400 transition-all rounded-xl"
                              title="Arquivar"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteMessage(msg.id)}
                              className="p-2 text-zinc-600 hover:text-red-400 transition-all rounded-xl"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {msg.toolResult && (
                        <div className="mt-4 space-y-3 pt-4 border-t border-white/5">
                          {msg.toolResult.messages && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">E-mails Recentes</p>
                              {msg.toolResult.messages.map((email: any) => (
                                <div key={email.id} className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                                  <p className="text-sm font-bold text-white truncate">{email.subject || '(Sem Assunto)'}</p>
                                  <p className="text-xs text-zinc-400 truncate">De: {email.from}</p>
                                  <p className="text-[10px] text-zinc-500 mt-1 italic line-clamp-1">{email.snippet}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.toolResult.report && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Relatório Gerado</p>
                              <ReportCard 
                report={msg.toolResult.report} 
                onArchive={async (id) => {
                  try {
                    await archiveReport(msg.toolResult.report);
                    addNotification('Reportagem arquivada com sucesso!', 'success');
                    // Refresh library if needed
                  } catch (error) {
                    errorService.log(error, ErrorCategory.DATABASE, 'Erro ao arquivar reportagem.');
                    addNotification('Erro ao arquivar reportagem.', 'error');
                  }
                }} 
              />
                            </div>
                          )}
                          {msg.toolResult.tasks && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Tarefas Pendentes</p>
                              {msg.toolResult.tasks.map((task: any) => (
                                <div key={task.id} className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors group">
                                  <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                                      <CheckSquare className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-white truncate">{task.title}</p>
                                      {task.due && (
                                        <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                                          <Calendar className="w-3 h-3" />
                                          Vencimento: {new Date(task.due).toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {task.notes && (
                                    <p className="text-[10px] text-zinc-400 mt-2 pl-8 line-clamp-2 italic">
                                      {task.notes}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.toolResult.report && (
                            <div className="mt-4">
                              <MariReportCard 
                                id={msg.toolResult.report.id || `report-${msg.id}`}
                                title={msg.toolResult.report.title}
                                content={msg.toolResult.report.content}
                                sources={msg.toolResult.report.sources || []}
                                youtubeVideos={msg.toolResult.report.youtubeVideos || []}
                                onSave={() => {
                                  if (user) {
                                    memoryService.saveReport(user.uid, msg.toolResult.report);
                                    addNotification("Relatório salvo com sucesso.", "success");
                                  }
                                }}
                                onDelete={() => {
                                  setMessages(prev => prev.filter(m => m.id !== msg.id));
                                }}
                                onCopy={() => {
                                  copyToClipboard(msg.toolResult.report.content);
                                  addNotification("Conteúdo copiado.", "success");
                                }}
                                onView={() => {
                                  setActiveReport(msg.toolResult.report);
                                  setShowRevista(true);
                                }}
                              />
                            </div>
                          )}
                          {msg.toolResult.events && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Agenda</p>
                              {msg.toolResult.events.map((event: any) => (
                                <div key={event.id} className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-white">{event.summary}</p>
                                    {event.htmlLink && (
                                      <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-emerald-400">
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-zinc-500">{new Date(event.start.dateTime || event.start.date).toLocaleString()}</p>
                                  {event.location && (
                                    <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                                      <Search className="w-3 h-3" />
                                      {event.location}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.toolResult.files && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Arquivos Encontrados</p>
                                {msg.toolResult.files.length > 1 && (
                                  <button 
                                    onClick={() => {
                                      const allIds = msg.toolResult.files.map((f: any) => f.id);
                                      setSelectedFiles(prev => prev.length === allIds.length ? [] : allIds);
                                    }}
                                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest"
                                  >
                                    {selectedFiles.length === msg.toolResult.files.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {msg.toolResult.files.map((file: any) => (
                                  <div 
                                    key={file.id} 
                                    className={`group relative p-3 bg-zinc-800/50 rounded-xl border transition-all cursor-pointer ${
                                      selectedFiles.includes(file.id) ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/5 hover:border-white/20'
                                    }`}
                                    onClick={() => {
                                      // If user clicks the card, open the link
                                      // But if they click the checkbox area, toggle selection
                                      // For now, let's toggle selection if it's a "selection task"
                                      setSelectedFiles(prev => 
                                        prev.includes(file.id) ? prev.filter(id => id !== file.id) : [...prev, file.id]
                                      );
                                      // Also add to recent docs
                                      setRecentDocs(prev => {
                                        const filtered = prev.filter(d => d.id !== file.id);
                                        return [{ id: file.id, name: file.name, link: file.webViewLink, timestamp: Date.now() }, ...filtered].slice(0, 10);
                                      });
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                        selectedFiles.includes(file.id) ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
                                      }`}>
                                        {selectedFiles.includes(file.id) && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      {file.iconLink ? (
                                        <img src={file.iconLink} alt="" className="w-4 h-4" referrerPolicy="no-referrer" />
                                      ) : (
                                        <FileText className="w-4 h-4 text-blue-400" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{file.name}</p>
                                        <p className="text-[10px] text-zinc-500 truncate">{file.mimeType.split('.').pop()}</p>
                                      </div>
                                      <a 
                                        href={file.webViewLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 rounded-lg bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {selectedFiles.length > 0 && (
                                <motion.button
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  onClick={() => {
                                    // Send the selection back to the agent
                                    const selectedNames = msg.toolResult.files
                                      .filter((f: any) => selectedFiles.includes(f.id))
                                      .map((f: any) => f.name);
                                    sendMessage(`Confirmo a seleção dos arquivos: ${selectedNames.join(', ')}. Pode prosseguir com a organização.`);
                                    setSelectedFiles([]);
                                  }}
                                  className="w-full mt-2 p-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                                >
                                  <Check className="w-4 h-4" />
                                  Confirmar Seleção ({selectedFiles.length})
                                </motion.button>
                              )}
                            </div>
                          )}
                          {msg.toolResult.videos && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Vídeos do YouTube</p>
                                <button 
                                  onClick={async () => {
                                    try {
                                      const videos = msg.toolResult.videos;
                                      for (const video of videos) {
                                        await youtubeService.saveYouTubeVideo(user.uid, video);
                                      }
                                      addNotification(`${videos.length} vídeos salvos no Jarvis 360.`, "success");
                                    } catch (error) {
                                      addNotification("Erro ao salvar todos os vídeos.", "error");
                                    }
                                  }}
                                  className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 border border-red-500/20"
                                >
                                  <Bookmark className="w-3 h-3" /> Salvar Todos
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {msg.toolResult.videos.map((video: any) => (
                                  <motion.div 
                                    key={video.id}
                                    whileHover={{ scale: 1.02 }}
                                    className="bg-zinc-900/80 rounded-2xl overflow-hidden border border-white/5 hover:border-red-500/30 transition-all group"
                                  >
                                    <div className="relative aspect-video">
                                      <img 
                                        src={video.thumbnail} 
                                        alt={video.title} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div 
                                        className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer"
                                        onClick={() => setActiveVideo({ url: video.link, title: video.title })}
                                      >
                                        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                                          <Play className="w-6 h-6 text-white fill-current" />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="p-4">
                                      <h4 className="text-sm font-bold text-white line-clamp-2 mb-1">{video.title}</h4>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800 px-2 py-0.5 rounded-full">
                                          {video.channelTitle}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-zinc-500 line-clamp-2 mb-4">{video.description}</p>
                                      <div className="flex items-center justify-between gap-4 mt-4">
                                        <button 
                                          onClick={() => setActiveVideo({ url: video.link, title: video.title })}
                                          className="inline-flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-400 transition-colors"
                                        >
                                          Assistir no JESUS I.A.
                                          <Play className="w-3 h-3" />
                                        </button>
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={() => copyToClipboard(video.link)}
                                            className="p-1.5 text-zinc-500 hover:text-emerald-400 transition-colors rounded-lg"
                                            title="Copiar Link"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={async () => {
                                              try {
                                                await youtubeService.saveYouTubeVideo(user.uid, video);
                                                addNotification("Vídeo salvo no Jarvis 360.", "success");
                                              } catch (error) {
                                                addNotification("Erro ao salvar vídeo.", "error");
                                              }
                                            }}
                                            className="p-1.5 text-zinc-500 hover:text-blue-400 transition-colors rounded-lg"
                                            title="Arquivar/Salvar"
                                          >
                                            <Bookmark className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              // Local hide for this session
                                              addNotification("Vídeo ocultado.", "info");
                                            }}
                                            className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors rounded-lg"
                                            title="Fechar"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              addNotification("Vídeo removido da visualização.", "info");
                                            }}
                                            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors rounded-lg"
                                            title="Excluir"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.toolResult.contacts && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Contatos Encontrados</p>
                              {msg.toolResult.contacts.map((contact: any) => (
                                <div key={contact.id} className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 flex items-center gap-3">
                                  {contact.photo ? (
                                    <img src={contact.photo} alt={contact.name} className="w-8 h-8 rounded-full border border-white/10" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs">
                                      {contact.name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{contact.name}</p>
                                    <p className="text-[10px] text-zinc-500 truncate">{contact.email}</p>
                                    {contact.phone !== 'Sem Telefone' && <p className="text-[10px] text-zinc-600">{contact.phone}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.searchResults && msg.searchResults.length > 0 && (
                        <div className="mt-6 space-y-4">
                          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                            <Zap className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Vertex AI Search Engine</span>
                          </div>
                          
                          <details className="group">
                            <summary className="flex items-center gap-2 cursor-pointer p-4 bg-zinc-900/80 border border-white/5 rounded-2xl hover:bg-zinc-800 transition-all list-none shadow-xl">
                              <div className="p-2 bg-emerald-500/10 rounded-lg">
                                <Search className="w-4 h-4 text-emerald-500" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-bold text-zinc-200">Fontes Reais para Consulta</h4>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{msg.searchResults.length} referências encontradas</p>
                              </div>
                              <ChevronDown className="w-5 h-5 text-zinc-600 group-open:rotate-180 transition-transform" />
                            </summary>
                            
                            <div className="grid grid-cols-1 gap-4 pt-4 animate-in fade-in slide-in-from-top-2">
                              {msg.searchResults.map((result, idx) => (
                                <motion.div 
                                  key={idx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className="card-elegant group relative overflow-hidden"
                                >
                                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                      result.type === 'youtube' ? 'bg-red-500/10 text-red-500' : 
                                      result.type === 'drive' ? 'bg-blue-500/10 text-blue-500' : 
                                      'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                      {result.type === 'youtube' ? <Youtube className="w-4 h-4" /> : 
                                       result.type === 'drive' ? <FileText className="w-4 h-4" /> : 
                                       <ExternalLink className="w-4 h-4" />}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                      {result.source}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => {
                                        const isVideo = result.type === 'youtube' || result.link.includes('youtube.com') || result.link.includes('youtu.be') || result.link.includes('vimeo.com');
                                        if (isVideo) {
                                          setActiveVideo({ url: result.link, title: result.title });
                                        } else {
                                          window.open(result.link, '_blank');
                                        }
                                      }}
                                      className="p-2 bg-zinc-800/50 hover:bg-emerald-500/20 rounded-xl text-zinc-500 hover:text-emerald-400 transition-all border border-white/5"
                                    >
                                      {result.type === 'youtube' || result.link.includes('youtube.com') || result.link.includes('youtu.be') || result.link.includes('vimeo.com') ? <Play className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>
                                
                                <h4 className="text-sm font-bold text-white mb-2 leading-snug group-hover:text-emerald-400 transition-colors">
                                  {result.title}
                                </h4>
                                
                                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 mb-3">
                                  {result.summary}
                                </p>

                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                  <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-tighter">
                                    Verified Source // V-AI-{idx + 1}
                                  </span>
                                  <a 
                                    href={result.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-colors flex items-center gap-1"
                                  >
                                    Acessar Fonte <ChevronRight className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-zinc-900 p-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span className="text-sm text-zinc-400 italic">Processando...</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="glass-footer p-8 pt-4">
          <div className="max-w-4xl mx-auto">
            {selectedImage && (
              <div className="mb-4 relative inline-block">
                <img src={selectedImage} alt="Preview" className="h-24 w-24 object-cover rounded-2xl border-2 border-cyan-500/30 shadow-2xl" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {activeGenerations.length > 0 && (
              <div className="mb-6 space-y-3">
                {activeGenerations.map(gen => (
                  <motion.div 
                    key={gen.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-4 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-xl animate-pulse">
                          <BookOpen className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-widest">Gerando Artigo Protocolo Mari</p>
                          <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{gen.query}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => cancelGeneration(gen.id)}
                        className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl transition-all group"
                        title="Cancelar Geração"
                      >
                        <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${gen.progress}%` }}
                        className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-bold text-cyan-500 uppercase tracking-widest">Processando...</span>
                      <span className="text-[9px] font-bold text-zinc-500">{gen.progress}%</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            <div className="relative group">
              <AnimatePresence>
                {!isQuickModesCollapsed && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                      <button 
                        onClick={() => handleQuickModeClick('drive')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'drive' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="Google Drive"
                      >
                        <HardDrive className="w-4 h-4" /> Drive
                      </button>
                      <button 
                        onClick={() => handleQuickModeClick('youtube')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'youtube' ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="YouTube"
                      >
                        <Youtube className="w-4 h-4" /> YouTube
                      </button>
                      <button 
                        onClick={() => handleQuickModeClick('tasks')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'tasks' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="Tarefas"
                      >
                        <CheckSquare className="w-4 h-4" /> Tarefas
                      </button>
                      <button 
                        onClick={() => handleQuickModeClick('calendar')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'calendar' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="Calendário"
                      >
                        <Calendar className="w-4 h-4" /> Agenda
                      </button>
                      <button 
                        onClick={() => handleQuickModeClick('docs')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'docs' ? 'bg-blue-400/20 text-blue-300 border border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="Google Docs"
                      >
                        <FileText className="w-4 h-4" /> Docs
                      </button>
                      <button 
                        onClick={() => handleQuickModeClick('sheets')}
                        className={`px-4 py-2 rounded-xl flex items-center gap-2 text-[11px] font-black transition-all ${activeQuickMode === 'sheets' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-zinc-900/80 text-zinc-500 hover:bg-zinc-800 border border-white/5'}`}
                        title="Google Sheets"
                      >
                        <Layout className="w-4 h-4" /> Sheets
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative flex items-center">
                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                <input type="file" ref={fileInputRef} accept=".pdf" className="hidden" onChange={handleFileSelect} />
                
                <div className="absolute left-5 flex items-center gap-3 z-10">
                  <button 
                    onClick={() => setIsQuickModesCollapsed(!isQuickModesCollapsed)}
                    className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-all hover:text-cyan-400"
                    title={isQuickModesCollapsed ? "Mostrar Atalhos" : "Ocultar Atalhos"}
                  >
                    {isQuickModesCollapsed ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 transition-all hover:text-cyan-400"
                    title="Anexar Arquivo"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={activeQuickMode ? `Modo ${activeQuickMode.toUpperCase()} Ativo...` : "Comando JESUS I.A. ..."}
                  className="w-full bg-zinc-900/40 border border-white/10 rounded-[2rem] py-5 pl-28 pr-28 focus:outline-none focus:border-cyan-500/30 transition-all shadow-2xl backdrop-blur-xl focus:bg-zinc-900/60 text-sm font-medium tracking-wide"
                />

                <div className="absolute right-5 flex items-center gap-3 z-10">
                  <button 
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-2xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'hover:bg-white/5 text-zinc-500 hover:text-cyan-400'}`}
                    title={isRecording ? "Parar Gravação" : "Gravar Áudio"}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => sendMessage()}
                    disabled={!input.trim() && !isRecording}
                    className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl transition-all shadow-2xl shadow-cyan-500/20 group"
                  >
                    <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {transcription !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute bottom-full mb-6 left-0 w-full z-50"
                  >
                    <div className="bg-zinc-950/90 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-cyan-500/10 rounded-xl">
                            <Mic className="w-5 h-5 text-cyan-500" />
                          </div>
                          <span className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em]">Revisar Transcrição</span>
                        </div>
                        <button 
                          onClick={() => setTranscription(null)}
                          className="p-2 text-zinc-500 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <textarea
                        value={transcription}
                        onChange={(e) => setTranscription(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500/30 min-h-[120px] resize-none font-medium leading-relaxed"
                        placeholder="Editando transcrição..."
                      />
                      
                      <div className="flex items-center justify-end gap-4 mt-4">
                        <button
                          onClick={() => setTranscription(null)}
                          className="px-6 py-2 text-[10px] font-black text-zinc-500 hover:text-zinc-300 uppercase tracking-[0.2em] transition-colors"
                        >
                          Descartar
                        </button>
                        <button
                          onClick={() => {
                            sendMessage(transcription);
                            setTranscription(null);
                          }}
                          className="px-8 py-3 bg-cyan-500 text-black text-[10px] font-black rounded-2xl hover:bg-cyan-400 uppercase tracking-[0.2em] transition-all shadow-2xl shadow-cyan-500/20 flex items-center gap-3"
                        >
                          <Send className="w-4 h-4" />
                          Enviar Protocolo
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <p className="text-center text-[9px] text-zinc-700 mt-6 uppercase tracking-[0.4em] font-black">
            JESUS I.A. v1.0
          </p>
        </div>
      </div>
        ) : activeDashboard === 'calendar' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Google Agenda</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden">
              <GoogleCalendarDashboard uid={user?.uid || ''} />
            </div>
          </div>
        ) : activeDashboard === 'tasks' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Google Tasks</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden">
              <GoogleTasksDashboard uid={user?.uid || ''} />
            </div>
          </div>
        ) : activeDashboard === 'gmail' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Gmail</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden">
              <GoogleGmailDashboard uid={user?.uid || ''} />
            </div>
          </div>
        ) : activeDashboard === 'maps' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Mapas</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden p-6">
              <GalleryWrapper 
                title="Meus Mapas" 
                onClose={() => setActiveDashboard('chat')}
                onDelete={() => {}}
              >
                <MapGallery 
                  maps={maps} 
                  onDeleteMap={(id) => setMaps(prev => prev.filter(m => m.id !== id))} 
                />
              </GalleryWrapper>
            </div>
          </div>
        ) : activeDashboard === 'photos' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Galeria de Fotos</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden p-6">
              <GooglePhotosDashboard uid={user.uid} />
            </div>
          </div>
        ) : activeDashboard === 'cards' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="p-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">Cards & Notas</h2>
              </div>
              <button onClick={() => setActiveDashboard('chat')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400"><X className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-hidden p-6">
              <CardLibrary 
                isOpen={true}
                onClose={() => setActiveDashboard('chat')}
                uid={user?.uid || ''}
              />
            </div>
          </div>
        ) : null}
      </main>

      {/* Sidebar (Right & Retractable) */}
      <aside className={`glass-sidebar ${isSidebarOpen ? 'w-20' : 'w-0'} flex flex-col transition-all duration-500 relative group/sidebar shadow-2xl z-40`}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute -left-6 top-1/2 -translate-y-1/2 bg-zinc-900/90 border border-white/10 p-2 rounded-full text-cyan-500 hover:text-white z-50 transition-all shadow-2xl ${isSidebarOpen ? 'opacity-0 group-hover/sidebar:opacity-100' : 'opacity-100'}`}
        >
          {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
        
        <div className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-500 flex flex-col h-full overflow-hidden w-20`}>
          <div className="p-4 flex flex-col items-center gap-2">
            <div className="relative">
              <Brain className="w-10 h-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            </div>
          </div>
          
          <nav className="flex-1 px-2 space-y-4 overflow-y-auto custom-scrollbar flex flex-col items-center py-4">
            {[
              { 
                icon: Calendar, 
                label: 'Agenda', 
                onClick: () => setActiveDashboard('calendar'), 
                count: workspaceCounts.calendar,
                color: 'text-yellow-500',
                tooltip: 'Agenda & Compromissos'
              },
              { 
                icon: Mail, 
                label: 'E-mail', 
                onClick: () => setActiveDashboard('gmail'), 
                count: workspaceCounts.gmail,
                color: 'text-blue-500',
                tooltip: 'Gmail Unificado'
              },
              { 
                icon: FileText, 
                label: 'Documentos', 
                onClick: () => window.open('https://docs.google.com', '_blank'), 
                external: true, 
                color: 'text-cyan-500',
                tooltip: 'Google Docs',
                size: 'w-8 h-8'
              },
              { 
                icon: Table, 
                label: 'Planilhas', 
                onClick: () => window.open('https://docs.google.com/spreadsheets', '_blank'), 
                external: true, 
                color: 'text-emerald-500',
                tooltip: 'Google Sheets',
                size: 'w-8 h-8'
              },
              { 
                icon: CheckCircle2, 
                label: 'Tarefas', 
                onClick: () => setActiveDashboard('tasks'), 
                count: workspaceCounts.tasks,
                color: 'text-yellow-400',
                tooltip: 'Google Tasks'
              },
              { 
                icon: Youtube, 
                label: 'YouTube', 
                onClick: () => setShowYouTubeLibrary(true), 
                color: 'text-red-500',
                tooltip: 'YouTube Library'
              },
              { 
                icon: Cloud, 
                label: 'Google Drive', 
                onClick: () => setActiveQuickMode('drive'), 
                color: 'text-blue-400',
                tooltip: 'Google Drive'
              },
              { 
                icon: RefreshCw, 
                label: 'Sincronizar', 
                onClick: () => setShowWorkspaceSync(true), 
                color: 'text-cyan-400',
                tooltip: 'Sincronizar Workspace'
              },
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={item.onClick}
                className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group/nav relative"
              >
                <div className="relative">
                  <item.icon className={`${item.size || 'w-7 h-7'} ${item.color} transition-transform group-hover/nav:scale-110 drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]`} />
                  {item.count !== undefined && item.count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full font-black min-w-[14px] h-[14px] flex items-center justify-center">
                      {item.count}
                    </span>
                  )}
                </div>
                
                {/* Tooltip */}
                <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover/nav:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl translate-x-2 group-hover/nav:translate-x-0 pointer-events-none">
                  {item.tooltip}
                </span>
              </button>
            ))}
          </nav>
          
          <div className="p-2 mt-auto border-t border-white/5 space-y-4 flex flex-col items-center py-6">
            <button 
              onClick={() => setActiveDashboard('cards')} 
              className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group/btn relative"
            >
              <StickyNote className="w-7 h-7 text-cyan-400 group-hover/btn:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover/btn:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl translate-x-2 group-hover/btn:translate-x-0 pointer-events-none">
                Cards & Notas
              </span>
            </button>

            <button 
              onClick={() => setActiveDashboard('maps')} 
              className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group/btn relative"
            >
              <MapIcon className="w-7 h-7 text-blue-500 group-hover/btn:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover/btn:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl translate-x-2 group-hover/btn:translate-x-0 pointer-events-none">
                Mapas
              </span>
            </button>

            <button 
              onClick={() => setActiveDashboard('photos')} 
              className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group/btn relative"
            >
              <Image className="w-7 h-7 text-purple-500 group-hover/btn:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover/btn:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl translate-x-2 group-hover/btn:translate-x-0 pointer-events-none">
                Fotos
              </span>
            </button>

            <button onClick={() => setShowSettings(true)} className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-white/5 transition-all text-zinc-400 hover:text-white group relative">
              <Settings className="w-7 h-7 text-zinc-500 group-hover:rotate-90 transition-transform duration-500 drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl pointer-events-none">
                Configurações
              </span>
            </button>

            <button onClick={handleLogout} className="w-12 h-12 flex items-center justify-center rounded-2xl hover:bg-red-500/10 transition-all text-red-500 hover:text-red-400 group relative">
              <LogOut className="w-7 h-7 group-hover:-translate-x-1 transition-transform drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]" />
              <span className="absolute left-full ml-4 px-3 py-2 bg-black/90 text-[10px] font-bold text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap border border-white/10 z-50 shadow-2xl pointer-events-none">
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {isNotesOpen && (
          <QuickNotes 
            user={user} 
            apiKey={activeApiKey || ""} 
            onClose={() => setIsNotesOpen(false)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLiveMode && user && (
          <GeminiLive 
            apiKey={activeApiKey || ""} 
            voiceName={selectedVoice} 
            onChangeVoice={setSelectedVoice}
            onClose={() => setShowLiveMode(false)}
            isLocalStorageEnabled={storageConfig.mode !== 'memory'}
            sessionId={currentSessionId}
            uid={user.uid}
            cards={cards}
            setCards={setCards}
            onApproveNote={(id) => setIsNoteApproved(true)}
            backgroundTasks={backgroundTasks}
            setBackgroundTasks={setBackgroundTasks}
            setMaps={setMaps}
            setPhotos={setPhotos}
            addTask={addTask}
            updateTaskProgress={updateTaskProgress}
            removeTask={removeTask}
            setActiveReport={setActiveReport}
            setShowRevista={setShowRevista}
          />
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 min-w-[300px] ${
                notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-400'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
               notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
               <Info className="w-5 h-5" />}
              <span className="text-sm font-medium">{notification.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSearchLibrary && user && (
          <SearchLibrary 
            uid={user.uid} 
            onClose={() => setShowSearchLibrary(false)} 
            isLocalStorageEnabled={storageConfig.mode !== 'memory'}
            onPlayVideo={(url, title) => setActiveVideo({ url, title })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showYouTubeLibrary && user && (
          <YouTubeLibrary 
            uid={user.uid} 
            sessionId={currentSessionId}
            onClose={() => setShowYouTubeLibrary(false)}
            isLocalStorageEnabled={storageConfig.mode !== 'memory'}
            onPlayVideo={(url, title) => setActiveVideo({ url, title })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCardLibrary && (
          <CardLibrary 
            isOpen={showCardLibrary} 
            onClose={() => setShowCardLibrary(false)} 
            uid={user?.uid || ''} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWorkspaceSync && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-6xl max-h-full overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl">
                    <Cloud className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Workspace Sync</h2>
                </div>
                <button 
                  onClick={() => setShowWorkspaceSync(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <GoogleWorkspaceDashboard uid={user?.uid || ''} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMapLibrary && (
          <MapGallery 
            maps={maps} 
            onDeleteMap={(id) => setMaps(prev => prev.filter(m => m.id !== id))} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDataTree && user && (
          <DataTreeView 
            uid={user.uid} 
            onClose={() => setShowDataTree(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMemory && user && (
          <MemorySection 
            uid={user.uid} 
            onClose={() => setShowMemory(false)} 
            onRestore={async (sessionId) => {
              const userSessions = await memoryService.getSessions(user.uid);
              setSessions(userSessions);
              showNotification("Conversa restaurada da memória.");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
