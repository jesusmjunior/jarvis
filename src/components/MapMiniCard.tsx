import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { MapComponent } from './MapComponent';

interface MapMiniCardProps {
  id: string;
  title: string;
  markers: Array<{ position: [number, number]; title: string; description?: string }>;
  route?: Array<[number, number]>;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export const MapMiniCard: React.FC<MapMiniCardProps> = ({ id, title, markers, route, onClose, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={`bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-50' : 'w-64 h-48'}`}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white">
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button onClick={() => onDelete(id)} className="p-1.5 bg-red-500/50 hover:bg-red-500/70 rounded-lg text-white">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="w-full h-full">
        <MapComponent markers={markers} route={route} />
      </div>
    </motion.div>
  );
};
