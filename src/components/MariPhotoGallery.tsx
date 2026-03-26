import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Download, Trash2, X, Layout } from 'lucide-react';
import { whiteboardManager } from '../utils/WhiteboardManager';

interface Photo {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  metadata?: any;
}

interface MariPhotoGalleryProps {
  photos: Photo[];
  onDelete?: (id: string) => void;
  onSaveToGallery?: (photo: Photo) => void;
}

export const MariPhotoGallery: React.FC<MariPhotoGalleryProps> = ({ photos, onDelete, onSaveToGallery }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-zinc-500">
        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
        <p>Nenhuma foto encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
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
            </div>
          </motion.div>
        ))}
      </div>

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
                  <h2 className="text-xl font-bold text-white leading-tight mb-2">{selectedPhoto.title}</h2>
                  <p className="text-zinc-500 text-xs">
                    {new Date(selectedPhoto.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      whiteboardManager.send({ 
                        type: 'ADD_CARD', 
                        card: { 
                          id: selectedPhoto.id, 
                          type: 'photo', 
                          title: selectedPhoto.title, 
                          content: `![${selectedPhoto.title}](${selectedPhoto.metadata?.baseUrl ? `${selectedPhoto.metadata.baseUrl}=w1024` : selectedPhoto.url})` 
                        } 
                      });
                      setSelectedPhoto(null);
                    }}
                    className="w-full py-3 bg-indigo-500/10 text-indigo-400 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-indigo-500/20 transition-all"
                  >
                    <Layout className="w-4 h-4" />
                    Enviar para Lousa
                  </button>
                  {onSaveToGallery && (
                    <button
                      onClick={() => {
                        onSaveToGallery(selectedPhoto);
                        setSelectedPhoto(null);
                      }}
                      className="w-full py-3 bg-blue-500/10 text-blue-400 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Salvar na Galeria
                    </button>
                  )}
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
                  {onDelete && (
                    <button
                      onClick={() => {
                        onDelete(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }}
                      className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
