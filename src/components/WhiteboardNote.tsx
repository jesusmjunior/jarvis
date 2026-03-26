import React, { useState } from 'react';
import { Trash2, Archive, Copy, ChevronDown, ChevronUp, Edit2, Check, X, FileText, Maximize2, Minimize2, Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { TTSPlayer } from './TTSPlayer';
import { whiteboardManager } from '../utils/WhiteboardManager';

interface WhiteboardNoteProps {
  card: Card;
  onUpdate: (id: string, content: string, title?: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onApprove: (id: string) => void;
  onClose?: (id: string) => void;
}

export const WhiteboardNote: React.FC<WhiteboardNoteProps> = ({ card, onUpdate, onDelete, onArchive, onApprove, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(card.isCollapsed || false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title || '');
  const [isMaximized, setIsMaximized] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(card.content);
  };

  const handleSaveTitle = () => {
    onUpdate(card.id, card.content, editTitle);
    setIsEditingTitle(false);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return (
    <>
      <AnimatePresence>
        {isMaximized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-indigo-500/10 rounded-xl">
                    <FileText className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">{card.title || 'Relatório Informativo'}</h2>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">PDI Direcional • Inteligência Artificial</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
                    title="Copiar"
                  >
                    <Copy size={20} />
                  </button>
                  <button 
                    onClick={toggleMaximize}
                    className="p-2 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
                    title="Fechar"
                  >
                    <Minimize2 size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto p-8 custom-scrollbar bg-black/20">
                <div className="max-w-3xl mx-auto">
                  <MarkdownRenderer content={card.content} isMariReport={true} />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 bg-zinc-900/50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <TTSPlayer text={card.content} />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      whiteboardManager.send({ 
                        type: 'ADD_CARD', 
                        card: { id: card.id, type: 'note', title: card.title, content: card.content } 
                      });
                    }}
                    className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    title="Enviar para Lousa (Monitor B)"
                  >
                    <Layout size={16} /> Monitor B
                  </button>
                  <button 
                    onClick={() => onDelete(card.id)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                  <button 
                    onClick={() => onArchive(card.id)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    <Archive size={16} /> Arquivar
                  </button>
                  <button 
                    onClick={() => onApprove(card.id)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                  >
                    <Check size={16} /> Aprovar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group bg-zinc-900 border border-white/5 rounded-2xl p-5 shadow-lg transition-all hover:border-indigo-500/20 ${isCollapsed ? 'h-auto' : ''} ${isMaximized ? 'opacity-0 pointer-events-none' : ''}`}
      >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3 flex-1 overflow-hidden mr-2">
          <div className="p-1.5 bg-indigo-500/5 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-indigo-400/70" />
          </div>
          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="bg-zinc-900 text-white text-sm font-bold px-2 py-1 rounded-md border border-white/20 w-full focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button onClick={handleSaveTitle} className="p-1 hover:bg-white/10 rounded-lg text-green-400">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 overflow-hidden">
              <h3 className="text-sm font-bold text-white truncate uppercase tracking-wider">{card.title || 'Relatório Informativo'}</h3>
              <button onClick={() => { setEditTitle(card.title || ''); setIsEditingTitle(true); }} className="p-1 hover:bg-white/10 rounded-lg text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <Edit2 size={12} />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
          <button 
            onClick={() => {
              whiteboardManager.send({ 
                type: 'ADD_CARD', 
                card: { id: card.id, type: 'note', title: card.title, content: card.content } 
              });
            }}
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
            title="Enviar para Lousa (Monitor B)"
          >
            <Layout size={16} />
          </button>
          <button 
            onClick={toggleMaximize} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
            title="Maximizar"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            title={isCollapsed ? 'Expandir' : 'Recolher'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button 
            onClick={copyToClipboard} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Copiar Conteúdo"
          >
            <Copy size={16} />
          </button>
          <button 
            onClick={() => onArchive(card.id)} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
            title="Arquivar"
          >
            <Archive size={16} />
          </button>
          <button 
            onClick={() => onDelete(card.id)} 
            className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
            title="Excluir Permanentemente"
          >
            <Trash2 size={16} />
          </button>
          {onClose && (
            <button 
              onClick={() => onClose(card.id)} 
              className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
              title="Fechar"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="text-sm text-zinc-300 overflow-hidden leading-relaxed font-serif mt-4">
            <MarkdownRenderer content={card.content} isMariReport={true} />
          </div>
          
          <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-4">
            <TTSPlayer text={card.content} />
            <div className="flex gap-2">
              <button 
                onClick={() => onApprove(card.id)} 
                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Validar Informação
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
    </>

  );
};
