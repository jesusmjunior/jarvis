import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Mail, Search, Star, Clock, Send, File, ChevronLeft, ChevronRight, 
  MoreVertical, Menu, Settings, HelpCircle, Archive, Trash2, 
  AlertCircle, RefreshCw, Plus, X, Check, Loader2, Inbox, 
  Tag, Users, Info, Flag, Paperclip
} from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { GmailAutomationRules } from './GmailAutomationRules';
import { EmailComposer } from './EmailComposer';

interface Email {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  authResults?: string;
  spf?: string;
  dkim?: string;
  dmarc?: string;
}

export default function GoogleGmailDashboard({ uid }: { uid: string }) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailContent, setEmailContent] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const handleSendEmail = async (email: { to: string; subject: string; body: string }) => {
    // Implement sending logic here using apiFetch('/api/tools/gmail/send', ...)
    setIsComposerOpen(false);
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const cached = localStorage.getItem(`gmail_data_${uid}`);
      if (cached) setEmails(JSON.parse(cached));

      const res = await apiFetch('/api/tools/gmail/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxResults: 20 })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.messages) {
          const formattedEmails = json.messages.map((m: any) => ({
            id: m.id,
            threadId: m.threadId,
            from: m.from || 'Desconhecido',
            subject: m.subject || '(Sem assunto)',
            snippet: m.snippet || '',
            date: m.date || '',
            isRead: !m.labelIds?.includes('UNREAD'),
            isStarred: m.labelIds?.includes('STARRED'),
            authResults: m.authResults,
            spf: m.spf,
            dkim: m.dkim,
            dmarc: m.dmarc
          }));
          setEmails(formattedEmails);
          localStorage.setItem(`gmail_data_${uid}`, JSON.stringify(formattedEmails));
        }
      }
    } catch (error) {
      console.error("Erro ao carregar e-mails:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, [uid]);

  const syncEmails = async () => {
    setStatus('syncing');
    try {
      await fetchEmails();
    } finally {
      setStatus('idle');
    }
  };

  const fetchEmailDetails = async (emailId: string) => {
    setEmailContent(null);
    try {
      const res = await apiFetch('/api/tools/gmail/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: emailId })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.message) {
          setEmailContent(json.message.body || json.message.snippet);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes do e-mail:", error);
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    fetchEmailDetails(email.id);
  };

  const filteredEmails = emails.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.from.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [activeTab, setActiveTab] = useState<'inbox' | 'rules'>('inbox');

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-700">
        <div className="flex items-center gap-4">
          <Menu className="w-5 h-5 text-zinc-400 cursor-pointer" />
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6 text-red-500" />
            <span className="text-xl font-medium">Gmail</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('inbox')} className={`px-3 py-1.5 rounded-none text-sm ${activeTab === 'inbox' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>Entrada</button>
          <button onClick={() => setActiveTab('rules')} className={`px-3 py-1.5 rounded-none text-sm ${activeTab === 'rules' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>Regras</button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Pesquisar e-mails" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 focus:border-zinc-500 rounded-none pl-10 pr-4 py-1.5 text-sm w-64 focus:outline-none"
            />
          </div>
          <button onClick={syncEmails} className="p-2 hover:bg-white/5 rounded-full text-zinc-400" title="Sincronizar">
            <RefreshCw className={`w-5 h-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-700 p-4 flex flex-col gap-6">
          <button onClick={() => setIsComposerOpen(true)} className="flex items-center gap-3 px-4 py-3 bg-zinc-800 text-white rounded-none font-medium">
            <Plus className="w-6 h-6" />
            <span>Escrever</span>
          </button>

          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-2 bg-red-900 text-red-200 rounded-none text-sm font-medium">
              <Inbox className="w-4 h-4" />
              <span>Entrada</span>
              <span className="ml-auto text-xs font-bold">{emails.filter(e => !e.isRead).length}</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-800 text-zinc-400 rounded-none text-sm font-medium">
              <Star className="w-4 h-4" />
              <span>Com estrela</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-800 text-zinc-400 rounded-none text-sm font-medium">
              <Clock className="w-4 h-4" />
              <span>Adiados</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-zinc-800 text-zinc-400 rounded-none text-sm font-medium">
              <Send className="w-4 h-4" />
              <span>Enviados</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'rules' ? (
            <GmailAutomationRules />
          ) : selectedEmail ? (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setSelectedEmail(null)} className="p-2 hover:bg-white/5 rounded-full text-zinc-400">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-zinc-400 cursor-pointer hover:text-white" />
                  <Trash2 className="w-5 h-5 text-zinc-400 cursor-pointer hover:text-white" />
                  <Mail className="w-5 h-5 text-zinc-400 cursor-pointer hover:text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-medium text-white">{selectedEmail.subject}</h2>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedEmail.from[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{selectedEmail.from}</p>
                    <p className="text-xs text-zinc-500">para mim</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{selectedEmail.date}</span>
                  <Star className={`w-4 h-4 ${selectedEmail.isStarred ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                  <MoreVertical className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {emailContent || <Loader2 className="w-5 h-5 animate-spin text-red-500" />}
              </div>
              
              <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 text-xs text-zinc-400 space-y-2">
                <h4 className="font-bold text-zinc-200">Segurança e Autenticação</h4>
                <p>SPF: {selectedEmail.spf || 'N/A'}</p>
                <p>DKIM: {selectedEmail.dkim || 'N/A'}</p>
                <p>DMARC: {selectedEmail.dmarc || 'N/A'}</p>
                <p className="break-all">Resultados: {selectedEmail.authResults || 'N/A'}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-8 px-4 py-2 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <div className="flex items-center gap-2 text-red-400 border-b-2 border-red-400 pb-2 px-2">
                  <Inbox className="w-4 h-4" />
                  <span>Principal</span>
                </div>
                <div className="flex items-center gap-2 hover:text-zinc-300 cursor-pointer pb-2 px-2">
                  <Tag className="w-4 h-4" />
                  <span>Promoções</span>
                </div>
                <div className="flex items-center gap-2 hover:text-zinc-300 cursor-pointer pb-2 px-2">
                  <Users className="w-4 h-4" />
                  <span>Social</span>
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {filteredEmails.map(email => (
                  <div 
                    key={email.id} 
                    onClick={() => handleEmailClick(email)}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors group ${!email.isRead ? 'bg-white/5' : ''}`}
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <input type="checkbox" className="accent-red-500" onClick={(e) => e.stopPropagation()} />
                      <Star className={`w-4 h-4 ${email.isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                    </div>
                    
                    <div className={`w-48 shrink-0 text-sm truncate ${!email.isRead ? 'font-bold text-white' : 'text-zinc-400'}`}>
                      {email.from}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-bold text-white' : 'text-zinc-200'}`}>{email.subject}</span>
                      <span className="text-sm text-zinc-500 truncate">- {email.snippet}</span>
                    </div>
                    
                    <div className={`w-20 text-right text-xs ${!email.isRead ? 'font-bold text-white' : 'text-zinc-500'}`}>
                      {email.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      {isComposerOpen && <EmailComposer onClose={() => setIsComposerOpen(false)} onSend={handleSendEmail} />}
    </div>
  );
}
