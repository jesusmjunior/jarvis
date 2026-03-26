import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Library, Search, Filter, Grid, List as ListIcon, Trash2, Archive, Maximize2 } from 'lucide-react';
import { Card } from '../types';
import { apiFetch } from '../services/apiClient';
import { WhiteboardNote } from './WhiteboardNote';

interface CardLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
}

export const CardLibrary: React.FC<CardLibraryProps> = ({ isOpen, onClose, uid }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (isOpen) {
      fetchArchivedCards();
    }
  }, [isOpen]);

  const fetchArchivedCards = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/db/cards/${uid}`);
      const data = await response.json();
      // Filter for archived cards or show all? User said "arquivo é arquivado no componente biblioteca de cards"
      // So maybe it shows everything but highlights archived? Or just archived.
      // Let's show all cards but allow filtering.
      setCards(data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = cards.filter(card => 
    card.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.content?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/db/cards/${id}`, { method: 'DELETE' });
      setCards(cards.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleUpdate = async (id: string, content: string, title?: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const updatedCard = { ...card, content, title: title || card.title };
    try {
      await apiFetch('/api/db/cards', {
        method: 'POST',
        body: JSON.stringify(updatedCard)
      });
      setCards(cards.map(c => c.id === id ? updatedCard : c));
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <Library className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Biblioteca de Cards</h2>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Arquivo Central de Inteligência</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="PESQUISAR NO ARQUIVO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-64 font-mono"
                />
              </div>

              <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Grid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <ListIcon size={18} />
                </button>
              </div>

              <button 
                onClick={onClose}
                className="p-3 hover:bg-white/10 rounded-2xl text-zinc-400 transition-all hover:text-white border border-white/5"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-zinc-500 font-mono text-xs uppercase animate-pulse">Acessando Banco de Dados ACID...</p>
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="p-6 bg-white/5 rounded-full mb-6">
                  <Archive className="w-12 h-12 text-zinc-700" />
                </div>
                <h3 className="text-xl font-bold text-zinc-400 mb-2">Nenhum card encontrado</h3>
                <p className="text-zinc-600 max-w-md">Sua biblioteca está vazia ou nenhum resultado corresponde à sua pesquisa.</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                : "max-w-4xl mx-auto space-y-6"
              }>
                {filteredCards.map(card => (
                  <div key={card.id} className="relative">
                    <WhiteboardNote 
                      card={card}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onArchive={() => {}} // Already in library
                      onApprove={() => {}}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-zinc-950/50 flex justify-between items-center px-8">
            <div className="flex gap-4 text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
              <span>Total: {cards.length} itens</span>
              <span>•</span>
              <span>Sincronizado: Supabase ACID</span>
            </div>
            <button 
              onClick={fetchArchivedCards}
              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
            >
              Atualizar Biblioteca
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
