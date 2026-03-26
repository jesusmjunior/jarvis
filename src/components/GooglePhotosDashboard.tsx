import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Download, Trash2, X, RefreshCw, Wand2, Tag, Edit2, Check, Search, Filter } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

interface Photo {
  id: string;
  uid: string;
  url: string;
  title: string;
  timestamp: number;
  metadata: {
    mimeType?: string;
    mediaMetadata?: any;
    baseUrl?: string;
    tags?: string[];
  };
}

interface GooglePhotosDashboardProps {
  uid: string;
}

export const GooglePhotosDashboard: React.FC<GooglePhotosDashboardProps> = ({ uid }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [analyzingPhotos, setAnalyzingPhotos] = useState<string[]>([]);

  useEffect(() => {
    fetchPhotos();
  }, [uid]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/db/photos/${uid}`);
      const data = await response.json();
      if (data.success && data.photos) {
        setPhotos(data.photos);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await apiFetch('/api/db/photos-sync', {
        method: 'POST',
        body: JSON.stringify({ uid })
      });
      const data = await response.json();
      if (data.success && data.photos) {
        setPhotos(data.photos);
      } else {
        throw new Error(data.error || 'Erro desconhecido ao sincronizar fotos');
      }
    } catch (error: any) {
      console.error('Error syncing photos:', error);
      if (error.message?.includes('insufficient authentication scopes') || error.message?.includes('scopes')) {
        alert('Permissão negada. Para sincronizar fotos, você precisa autorizar o acesso ao Google Fotos. Por favor, desconecte e faça login novamente, certificando-se de marcar a caixa de permissão do Google Fotos.');
      } else {
        alert('Erro ao sincronizar fotos: ' + error.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!window.confirm('Tem certeza que deseja excluir esta foto?')) return;

    try {
      // Try to delete from Google Photos API (might fail if not created by app)
      await apiFetch('/api/tools/photos/delete', {
        method: 'POST',
        body: JSON.stringify({ mediaItemId: photo.id })
      }).catch(err => console.warn('Google Photos API delete failed:', err));

      // Always delete from local DB
      await apiFetch(`/api/db/photos/${photo.id}`, {
        method: 'DELETE'
      });

      setPhotos(photos.filter(p => p.id !== photo.id));
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      alert('Erro ao excluir a foto.');
    }
  };

  const handleUpdatePhoto = async (photoId: string, updates: Partial<Photo>) => {
    try {
      const photoToUpdate = photos.find(p => p.id === photoId);
      if (!photoToUpdate) return;

      const updatedPhoto = { ...photoToUpdate, ...updates };
      
      await apiFetch('/api/db/photos', {
        method: 'POST',
        body: JSON.stringify({ uid, photos: [updatedPhoto] })
      });

      setPhotos(photos.map(p => p.id === photoId ? updatedPhoto : p));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(updatedPhoto);
      }
    } catch (error) {
      console.error('Error updating photo:', error);
    }
  };

  const handleSaveTitle = () => {
    if (selectedPhoto && newTitle.trim() !== '') {
      handleUpdatePhoto(selectedPhoto.id, { title: newTitle });
      setEditingTitle(false);
    }
  };

  const handleImagezer = async (photo: Photo) => {
    if (analyzingPhotos.includes(photo.id)) return;
    
    setAnalyzingPhotos(prev => [...prev, photo.id]);
    try {
      const response = await apiFetch('/api/tools/photos/imagezer', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: photo.url })
      });
      const data = await response.json();

      if (data.success && data.result) {
        const { title, tags } = data.result;
        
        const updatedMetadata = {
          ...photo.metadata,
          tags: tags || []
        };

        await handleUpdatePhoto(photo.id, { 
          title: title || photo.title,
          metadata: updatedMetadata
        });
      }
    } catch (error) {
      console.error('Error analyzing photo:', error);
    } finally {
      setAnalyzingPhotos(prev => prev.filter(id => id !== photo.id));
    }
  };

  const handleBatchImagezer = async () => {
    const photosToAnalyze = photos.filter(p => !p.metadata?.tags || p.metadata.tags.length === 0);
    if (photosToAnalyze.length === 0) {
      alert('Todas as fotos já estão categorizadas!');
      return;
    }

    if (!window.confirm(`Deseja analisar e categorizar ${photosToAnalyze.length} fotos? Isso pode levar alguns minutos.`)) return;

    for (const photo of photosToAnalyze) {
      await handleImagezer(photo);
    }
  };

  const allTags = Array.from(new Set(photos.flatMap(p => p.metadata?.tags || [])));

  const filteredPhotos = photos.filter(photo => {
    const matchesSearch = photo.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag ? photo.metadata?.tags?.includes(selectedTag) : true;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white p-6 rounded-3xl border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-xl">
            <ImageIcon className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Google Fotos (Últimos 2 Meses)</h2>
            <p className="text-sm text-zinc-400">{photos.length} fotos sincronizadas</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBatchImagezer}
            disabled={syncing || analyzingPhotos.length > 0}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            Auto-Categorizar
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl font-medium text-sm flex items-center gap-2 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar fotos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedTag === null ? 'bg-white/20 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            Todas
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                selectedTag === tag ? 'bg-blue-500/30 text-blue-300' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
          <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
          <p>Nenhuma foto encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto pr-2 custom-scrollbar">
          {filteredPhotos.map((photo) => (
            <motion.div
              key={photo.id}
              layoutId={photo.id}
              whileHover={{ scale: 1.02 }}
              className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black/40 group cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={photo.url}
                alt={photo.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs text-white font-medium truncate mb-1">{photo.title}</p>
                {photo.metadata?.tags && photo.metadata.tags.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {photo.metadata.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/20 rounded-md text-white/90 truncate">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {analyzingPhotos.includes(photo.id) && (
                  <div className="absolute top-2 right-2 p-1.5 bg-purple-500/80 rounded-lg">
                    <Wand2 className="w-3 h-3 text-white animate-pulse" />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12"
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[110]"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-w-6xl w-full h-full flex flex-col md:flex-row gap-8 items-center justify-center">
              <motion.div
                layoutId={selectedPhoto.id}
                className="flex-1 relative aspect-auto max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center bg-black/50"
              >
                <img
                  src={selectedPhoto.metadata?.baseUrl ? `${selectedPhoto.metadata.baseUrl}=w2048` : selectedPhoto.url}
                  alt={selectedPhoto.title}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              <div className="w-full md:w-80 space-y-6 bg-zinc-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                <div>
                  {editingTitle ? (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                      />
                      <button onClick={handleSaveTitle} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingTitle(false)} className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2 mb-2 group">
                      <h2 className="text-xl font-bold text-white leading-tight">{selectedPhoto.title}</h2>
                      <button 
                        onClick={() => {
                          setNewTitle(selectedPhoto.title);
                          setEditingTitle(true);
                        }}
                        className="p-1.5 bg-white/5 text-zinc-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 hover:text-white shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-zinc-500 text-xs">
                    {new Date(selectedPhoto.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Categorias
                    </h4>
                    <button
                      onClick={() => handleImagezer(selectedPhoto)}
                      disabled={analyzingPhotos.includes(selectedPhoto.id)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Wand2 className="w-3 h-3" />
                      {analyzingPhotos.includes(selectedPhoto.id) ? 'Analisando...' : 'Auto-Tag'}
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedPhoto.metadata?.tags && selectedPhoto.metadata.tags.length > 0 ? (
                      selectedPhoto.metadata.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs font-medium border border-blue-500/20">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic">Sem categorias. Use o Auto-Tag para gerar.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      if (selectedPhoto.metadata?.baseUrl) {
                        window.open(`${selectedPhoto.metadata.baseUrl}=d`, '_blank');
                      } else {
                        window.open(selectedPhoto.url, '_blank');
                      }
                    }}
                    className="w-full py-3 bg-white/10 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Original
                  </button>
                  <button
                    onClick={() => handleDelete(selectedPhoto)}
                    className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir Foto
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
