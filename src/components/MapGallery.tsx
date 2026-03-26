import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapMiniCard } from './MapMiniCard';

interface MapGalleryProps {
  maps: Array<{
    id: string;
    title: string;
    markers: Array<{ position: [number, number]; title: string; description?: string }>;
    route?: Array<[number, number]>;
  }>;
  onDeleteMap: (id: string) => void;
}

export const MapGallery: React.FC<MapGalleryProps> = ({ maps, onDeleteMap }) => {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex gap-4 overflow-x-auto p-2 custom-scrollbar">
      <AnimatePresence>
        {maps.map((map) => (
          <MapMiniCard
            key={map.id}
            id={map.id}
            title={map.title}
            markers={map.markers}
            route={map.route}
            onClose={() => {}}
            onDelete={onDeleteMap}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
