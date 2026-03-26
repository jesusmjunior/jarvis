import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minimize2, Maximize2, Trash2 } from 'lucide-react';

interface GalleryWrapperProps {
  title: string;
  onClose: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export const GalleryWrapper: React.FC<GalleryWrapperProps> = ({ title, onClose, onDelete, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={`bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl ${
        isExpanded 
          ? 'fixed inset-4 z-[100] flex flex-col' 
          : 'w-64 h-48 flex flex-col'
      }`}
    >
      <div className="flex items-center justify-between p-3 bg-zinc-800/50 border-b border-white/5">
        <h3 className="text-xs font-bold text-white truncate">{title}</h3>
        <div className="flex gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-white/10 rounded">
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-white/10 rounded text-red-400">
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </motion.div>
  );
};
