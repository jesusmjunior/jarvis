import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Plus, Trash2, Save, Key, Database } from 'lucide-react';

export const MetadataManager: React.FC = () => {
  const [metadata, setMetadata] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadMetadata = async () => {
    setIsLoading(true);
    try {
      const data = await storageService.getAllMetadata();
      setMetadata(data || []);
    } catch (error) {
      console.error('Error loading metadata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  const handleAdd = async () => {
    if (!newKey.trim()) return;
    await storageService.saveMetadata(newKey, newValue);
    setNewKey('');
    setNewValue('');
    loadMetadata();
  };

  const handleDelete = async (key: string) => {
    await storageService.deleteMetadata(key);
    loadMetadata();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          Metadados da Aplicação
        </h3>
        <button 
          onClick={loadMetadata}
          className="text-[10px] text-emerald-500 hover:underline"
        >
          Atualizar
        </button>
      </div>

      <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4 space-y-4">
        {/* Add New */}
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="Chave"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <input 
            type="text"
            placeholder="Valor"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 bg-zinc-900 border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <button 
            onClick={handleAdd}
            className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <p className="text-[10px] text-zinc-500 text-center py-4">Carregando...</p>
          ) : metadata.length === 0 ? (
            <p className="text-[10px] text-zinc-500 text-center py-4">Nenhum metadado encontrado.</p>
          ) : (
            metadata.map((item) => (
              <div key={item.key} className="flex items-center justify-between bg-zinc-900/50 p-2 rounded-lg group">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-emerald-500">{item.key}</span>
                  <span className="text-[10px] text-zinc-400 truncate max-w-[150px]">{item.value}</span>
                </div>
                <button 
                  onClick={() => handleDelete(item.key)}
                  className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
