import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  onClose: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (isMinimized) setIsMinimized(false);
    setIsFullscreen(!isFullscreen);
  };

  const toggleMinimize = () => {
    if (isFullscreen) setIsFullscreen(false);
    setIsMinimized(!isMinimized);
  };

  // Extract video ID for YouTube/Vimeo
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1,
          width: isFullscreen ? '100vw' : isMinimized ? '300px' : '640px',
          height: isFullscreen ? '100vh' : isMinimized ? '180px' : '360px',
          bottom: isFullscreen ? 0 : '2rem',
          right: isFullscreen ? 0 : '2rem',
          zIndex: isFullscreen ? 9999 : 1000
        }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={`fixed bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-300`}
      >
        {/* Header/Controls */}
        <div className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-b from-black/90 to-transparent flex items-center justify-between px-6 opacity-0 hover:opacity-100 transition-opacity z-20">
          <span className="text-white text-sm font-bold truncate max-w-[60%] drop-shadow-lg">{title || 'JESUS I.A. Player'}</span>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleMinimize}
              className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-110 active:scale-95"
              title={isMinimized ? "Expandir" : "Minimizar"}
            >
              {isMinimized ? <Maximize2 className="w-5 h-5 text-white" /> : <Minimize2 className="w-5 h-5 text-white" />}
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-110 active:scale-95"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              <Maximize2 className="w-5 h-5 text-white" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-500 rounded-xl transition-all hover:scale-110 active:scale-95 group"
              title="Fechar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Video Content */}
        <div className="w-full h-full">
          <iframe
            src={embedUrl}
            className="w-full h-full border-none"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>

        {/* Minimized Overlay */}
        {isMinimized && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
            <div className="bg-emerald-500 p-2 rounded-full shadow-lg">
              <Play className="w-6 h-6 text-white fill-current" />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
