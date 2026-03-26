import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

// Fix for default marker icons in Leaflet with React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    title: string;
    description?: string;
  }>;
  route?: Array<[number, number]>; // [start, end]
}

// Routing component
const Routing = ({ waypoints }: { waypoints: Array<[number, number]> }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || waypoints.length < 2) return;

    const routingControl = (L as any).Routing.control({
      waypoints: waypoints.map(p => L.latLng(p[0], p[1])),
      lineOptions: {
        styles: [{ color: '#10b981', weight: 4 }]
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      showAlternatives: false,
      createMarker: () => null // Don't create extra markers
    }).addTo(map);

    return () => {
      if (map) {
        map.removeControl(routingControl);
      }
    };
  }, [map, waypoints]);

  return null;
};

export const MapComponent: React.FC<MapComponentProps> = ({ 
  center = [-23.5505, -46.6333], // São Paulo by default
  zoom = 13,
  markers = [],
  route = []
}) => {
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {markers.map((marker, idx) => (
          <Marker key={idx} position={marker.position}>
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-zinc-900">{marker.title}</h3>
                {marker.description && <p className="text-sm text-zinc-600">{marker.description}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {route.length >= 2 && <Routing waypoints={route} />}
      </MapContainer>
    </div>
  );
};
