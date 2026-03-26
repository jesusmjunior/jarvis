import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Maximize2, Minimize2 } from 'lucide-react';

import { MarkdownRenderer } from './MarkdownRenderer';

interface WhiteboardCard {
  id: string;
  type: string;
  content: string;
  title?: string;
  x: number;
  y: number;
}

export default function WhiteboardPopup() {
  const [cards, setCards] = useState<WhiteboardCard[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [port, setPort] = useState<MessagePort | null>(null);

  useEffect(() => {
    const handleInit = (event: MessageEvent) => {
      // Security: Validate origin
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'INIT_PORT' && event.ports.length > 0) {
        console.log('WhiteboardPopup: Received INIT_PORT, establishing channel');
        const newPort = event.ports[0];
        setPort(newPort);
        
        newPort.onmessage = (e) => {
          const data = e.data;
          console.log('WhiteboardPopup: Received message:', data.type);
          
          if (data.type === 'ADD_CARD') {
            setCards(prev => {
              // Avoid duplicate cards by ID if possible
              if (data.card.id && prev.some(c => c.id === data.card.id)) {
                return prev;
              }
              return [...prev, {
                id: data.card.id || Date.now().toString(),
                type: data.card.type,
                content: data.card.content,
                title: data.card.title,
                x: Math.random() * (window.innerWidth - 300),
                y: Math.random() * (window.innerHeight - 200)
              }];
            });
          } else if (data.type === 'CLEAR_BOARD') {
            setCards([]);
          } else if (data.type === 'REMOVE_CARD') {
            setCards(prev => prev.filter(c => c.id !== data.id));
          }
        };

        // Acknowledge port setup
        newPort.postMessage({ type: 'PORT_READY' });
      }
    };

    window.addEventListener('message', handleInit);
    
    console.log('WhiteboardPopup: Component mounted, sending WHITEBOARD_READY');
    if (window.opener) {
      window.opener.postMessage({ type: 'WHITEBOARD_READY' }, window.location.origin);
    } else {
      console.warn('WhiteboardPopup: No window.opener found');
    }

    return () => {
      window.removeEventListener('message', handleInit);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (port) port.close();
    };
  }, [port]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    // Notify parent
    if (port) {
      port.postMessage({ type: 'CARD_REMOVED', id });
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-zinc-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Zap className="w-5 h-5" />
          </div>
          <h1 className="text-sm font-bold tracking-wider">Lousa Criativa (Monitor B)</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCards([])}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Limpar Lousa
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="absolute inset-0 pt-14 relative w-full h-full">
        <AnimatePresence>
          {cards.map(card => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              drag
              dragMomentum={false}
              style={{ x: card.x, y: card.y }}
              className="absolute w-72 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between p-3 border-b border-white/5 bg-black/20">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider truncate pr-2">
                  {card.title || 'Card'}
                </span>
                <button 
                  onClick={() => removeCard(card.id)}
                  className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 text-sm text-zinc-300 max-h-64 overflow-y-auto custom-scrollbar">
                <MarkdownRenderer content={card.content} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {cards.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 pointer-events-none">
            <Zap className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Lousa Vazia</p>
            <p className="text-sm opacity-60">Envie cards da janela principal para cá.</p>
          </div>
        )}
      </div>
    </div>
  );
}
