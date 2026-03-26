import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, Download, Share2, Trash2, Loader2, Library, Search } from 'lucide-react';
import { Report, getReports, deleteReport } from '../services/reportService';
import RevistaEletronica from './RevistaEletronica';
import RevistaCard from './RevistaCard';

export default function RevistaEletronicaLibrary({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [viewingReportIndex, setViewingReportIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await getReports();
      setReports(data);
    } catch (e) {
      console.error('Erro ao carregar relatórios:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReports = reports.filter(report => 
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedReports);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedReports(newSelection);
  };

  const onNext = useCallback(() => {
    if (viewingReportIndex !== null && viewingReportIndex < filteredReports.length - 1) {
      setViewingReportIndex(viewingReportIndex + 1);
    }
  }, [viewingReportIndex, filteredReports.length]);

  const onPrev = useCallback(() => {
    if (viewingReportIndex !== null && viewingReportIndex > 0) {
      setViewingReportIndex(viewingReportIndex - 1);
    }
  }, [viewingReportIndex]);

  const exportSelected = () => {
    // Implement bulk export logic
    alert(`Exportando ${selectedReports.size} relatórios...`);
  };

  const publishSelected = () => {
    // Implement bulk publish logic
    alert(`Publicando ${selectedReports.size} relatórios...`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
    >
      <div className="max-w-7xl mx-auto bg-zinc-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden min-h-[80vh] flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-white/10 bg-zinc-950/50 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl">
              <Library className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Galeria de Reportagens</h1>
              <p className="text-sm text-zinc-400">Revista Eletrônica - Arquivo Digital</p>
            </div>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar por título..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 transition-colors self-end md:self-auto">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 px-6 flex items-center justify-between border-b border-white/5 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400 font-medium">
              {selectedReports.size} selecionado(s)
            </span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={exportSelected} 
              disabled={selectedReports.size === 0} 
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Exportar Lote
            </button>
            <button 
              onClick={publishSelected} 
              disabled={selectedReports.size === 0} 
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Share2 className="w-4 h-4" /> Publicar Selecionados
            </button>
          </div>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="animate-spin w-8 h-8 text-emerald-500" />
              <p className="text-zinc-400 font-medium">Carregando acervo...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-2">
                <BookOpen className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Nenhuma reportagem encontrada</h3>
              <p className="text-zinc-400 max-w-md">Tente ajustar sua busca ou gere novas reportagens com o JESUS I.A.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredReports.map((report, index) => (
                <RevistaCard 
                  key={report.id} 
                  report={report} 
                  isSelected={selectedReports.has(report.id)}
                  onToggleSelection={() => toggleSelection(report.id)}
                  onRead={() => setViewingReportIndex(index)}
                  onDelete={async () => {
                    if (confirm('Deseja excluir esta reportagem?')) {
                      await deleteReport(report.id);
                      setReports(prev => prev.filter(r => r.id !== report.id));
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {viewingReportIndex !== null && (
          <RevistaEletronica 
            report={filteredReports[viewingReportIndex]} 
            onClose={() => setViewingReportIndex(null)}
            onNext={viewingReportIndex < filteredReports.length - 1 ? onNext : undefined}
            onPrev={viewingReportIndex > 0 ? onPrev : undefined}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
