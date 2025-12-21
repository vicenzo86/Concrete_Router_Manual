
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { OptimizationResult } from '../types';
import L from 'leaflet';
import { Map as MapIcon, Truck, Building2, MapPin } from 'lucide-react';

interface MapTabProps {
  data: OptimizationResult;
  apiKey: string;
}

const MARKER_COLORS = [ '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316' ];

// Correção global de caminhos de assets do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createCustomIcon = (label: string | number, color: string, isSquare = false) => {
  return L.divIcon({
    className: 'custom-marker-wrapper',
    html: `
      <div class="${isSquare ? 'rounded-md' : 'rounded-full'} border-2 border-white text-white flex items-center justify-center font-black shadow-lg text-[11px]" 
           style="background-color: ${color}; width: 26px; height: 26px; transform: translate(-13px, -13px);">
        ${label}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [0, 0]
  });
};

/**
 * Componente interno que controla o motor do mapa
 */
const MapEffect: React.FC<{ works: any[]; branch: { lat: number, lng: number } }> = ({ works, branch }) => {
  const map = useMap();
  
  useEffect(() => {
    // ESSENCIAL: InvalidateSize força o Leaflet a recalcular os tiles baseados no tamanho real do DOM
    const refresh = () => {
      map.invalidateSize();
    };

    // Chamadas sucessivas para garantir o redimensionamento em abas dinâmicas
    refresh();
    const t1 = setTimeout(refresh, 100);
    const t2 = setTimeout(refresh, 600);
    const t3 = setTimeout(refresh, 1200);

    if (works.length > 0) {
      const points = works.map(w => [w.lat, w.lng] as [number, number]);
      if (branch) points.push([branch.lat, branch.lng]);
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map, works, branch]);
  
  return null;
};

export const MapTab: React.FC<MapTabProps> = ({ data, apiKey }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Força o componente a remontar o Leaflet quando o ID do resultado muda
  // Isso previne o estado "travado" do motor de renderização
  const mapKey = useMemo(() => `map-instance-${data.works.length}-${apiKey ? 'auth' : 'osm'}`, [data.works.length, apiKey]);

  if (data.works.length === 0) return (
    <div className="h-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-widest border-2 border-dashed border-slate-200 m-4 rounded-2xl">
      Nenhum plano gerado ainda
    </div>
  );

  const branchCoords: [number, number] = data.branchLocation 
    ? [data.branchLocation.lat, data.branchLocation.lng] 
    : [-26.8955, -48.6757];

  // Configuração de Tiles ultra-resiliente
  const isHereAvailable = apiKey && apiKey.length > 20;
  const tileUrl = isHereAvailable
    ? `https://{s}.base.maps.ls.hereapi.com/maptile/2.1/maptile/newest/normal.day/{z}/{x}/{y}/256/png8?apiKey=${apiKey}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="h-full w-full flex flex-col relative bg-slate-100 overflow-hidden">
      <style>{`
        /* CSS crítico para funcionamento do Leaflet v5 */
        .leaflet-container { 
          width: 100% !important; 
          height: 100% !important; 
          background: #e2e8f0 !important; 
          outline: none;
        }
        .custom-marker-wrapper { background: transparent !important; border: none !important; }
        .map-root-container { flex: 1; position: relative; width: 100%; height: 100%; min-height: 0; }
        .leaflet-tile-pane { opacity: 1 !important; }
      `}</style>
      
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-[1000]">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <MapIcon className="text-amber-500" size={20} /> Mapa de Rotas
          </h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase ml-7">Visualização Operacional</span>
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
          Provedor: {isHereAvailable ? 'HERE MAPS' : 'OPENSTREETMAP'}
        </div>
      </div>

      <div className="map-root-container">
        {mounted && (
          <MapContainer 
            key={mapKey}
            center={branchCoords} 
            zoom={13} 
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer 
              attribution='&copy; OpenStreetMap contributors' 
              url={tileUrl}
              subdomains={isHereAvailable ? "1234" : "abc"}
            />
            
            <MapEffect 
              works={data.works} 
              branch={data.branchLocation || {lat: branchCoords[0], lng: branchCoords[1]}} 
            />
            
            {/* Usina (DP) */}
            <Marker position={branchCoords} icon={createCustomIcon('DP', '#1e293b', true)}>
              <Popup><strong>Usina de Concreto</strong><br/>Ponto de Saída</Popup>
            </Marker>

            {/* Obras */}
            {data.works.map((work, idx) => {
              const markerColor = MARKER_COLORS[idx % MARKER_COLORS.length];
              return (
                <React.Fragment key={work.id}>
                  <Polyline 
                    positions={[branchCoords, [work.lat, work.lng]]} 
                    pathOptions={{ color: markerColor, weight: 3, opacity: 0.6, dashArray: '8, 12' }} 
                  />
                  <Marker position={[work.lat, work.lng]} icon={createCustomIcon(idx + 1, markerColor)}>
                    <Popup className="custom-popup">
                      <div className="p-1 min-w-[180px]">
                        <div className="font-black text-slate-900 text-sm mb-2 border-b border-slate-100 pb-1">
                          {idx + 1}. {work.name}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
                          <div className="text-slate-400">Cargas: <span className="text-blue-600">{work.loads}</span></div>
                          <div className="text-slate-400">Volume: <span className="text-emerald-600">{work.volume} m³</span></div>
                          <div className="text-slate-400">Frota: <span className="text-amber-600">{work.trucksAssigned}</span></div>
                          <div className="text-slate-400">Bomba: <span className="text-purple-600">{work.pumpId?.replace('BOMBA-', '') || 'N/A'}</span></div>
                        </div>
                        <div className="mt-2 text-[9px] text-slate-400 italic leading-tight">
                          {work.address}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        )}
      </div>
    </div>
  );
};
