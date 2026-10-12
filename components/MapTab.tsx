
import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { OptimizationResult } from '../types';
import L from 'leaflet';
import { Map as MapIcon, Layers, Building2, Truck, MapPin } from 'lucide-react';

interface MapTabProps {
  data: OptimizationResult;
  apiKey: string;
}

const MARKER_COLORS = [ '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316' ];

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
      <div class="${isSquare ? 'rounded-md' : 'rounded-full'} border-2 border-white text-white flex items-center justify-center font-black shadow-xl text-[10px]" 
           style="background-color: ${color}; width: 24px; height: 24px; transform: translate(-12px, -12px);">
        ${label}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [0, 0]
  });
};

const MapManager: React.FC<{ works: any[]; branch: { lat: number, lng: number } }> = ({ works, branch }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (works.length > 0) {
        const points = works.map(w => [w.lat, w.lng] as [number, number]);
        if (branch) points.push([branch.lat, branch.lng]);
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [map, works, branch]);
  return null;
};

export const MapTab: React.FC<MapTabProps> = ({ data, apiKey }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Pequeno delay para garantir que o container do Leaflet tenha dimensões
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Chave do mapa baseada apenas nos dados para evitar re-renderizações desnecessárias
  const mapKey = useMemo(() => `map-osm-${data.works.length}-${data.works.map(w => w.id).join('-')}`, [data.works]);

  if (data.works.length === 0) return (
    <div className="h-full flex items-center justify-center bg-slate-50 text-slate-400 font-black uppercase tracking-widest border-2 border-dashed border-slate-200 m-8 rounded-3xl">
      Inicie a simulação para visualizar o mapa...
    </div>
  );

  const branchCoords: [number, number] = data.branchLocation ? [data.branchLocation.lat, data.branchLocation.lng] : [-26.8955, -48.6757];
  const osmUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className="h-full w-full flex flex-col relative bg-slate-100">
      <style>{`
        .leaflet-container { width: 100% !important; height: 100% !important; background: #f8fafc; outline: none; }
        .custom-marker-wrapper { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 1rem !important; padding: 0 !important; overflow: hidden; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important; }
        .leaflet-popup-content { margin: 0 !important; width: 220px !important; }
        .leaflet-popup-tip-container { display: none !important; }
      `}</style>
      
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-[1001]">
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <MapIcon className="text-indigo-500" size={20} /> Mapa Operacional
          </h2>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-emerald-600 font-black uppercase flex items-center gap-1">
               <Layers size={10}/> Provedor: OpenStreetMap
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
               <Building2 size={10}/> Tempos: HERE • linhas: ligação direta
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {mounted && (
          <MapContainer 
            key={mapKey} 
            center={branchCoords} 
            zoom={13} 
            scrollWheelZoom={true} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer 
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
              url={osmUrl} 
            />
            <MapManager works={data.works} branch={data.branchLocation || {lat: branchCoords[0], lng: branchCoords[1]}} />
            
            <Marker position={branchCoords} icon={createCustomIcon('DP', '#0f172a', true)}>
              <Popup>
                <div className="p-2 font-bold text-slate-800">
                  Usina Principal (DP)
                </div>
              </Popup>
            </Marker>

            {data.works.map((work, idx) => {
              const markerColor = MARKER_COLORS[idx % MARKER_COLORS.length];
              return (
                <React.Fragment key={work.id}>
                  <Polyline 
                    positions={[branchCoords, [work.lat, work.lng]]} 
                    pathOptions={{ color: markerColor, weight: 3, opacity: 0.8, dashArray: '10, 10' }} 
                  />
                  <Marker position={[work.lat, work.lng]} icon={createCustomIcon(idx + 1, markerColor)}>
                    <Popup>
                      <div className="p-4 font-sans bg-white">
                        <div className="flex items-start gap-2 mb-3">
                          <div className="bg-slate-100 p-1.5 rounded-lg text-slate-500 shrink-0"><Building2 size={16} /></div>
                          <div className="font-bold text-[12px] leading-tight text-slate-800 pr-3">{work.name}</div>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3 space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="text-slate-400 uppercase tracking-tight">BOMBA DESIGNADA</span>
                            <span className="text-blue-600 font-black uppercase">{work.pumpId?.replace('-', ' ') || 'AGUARDANDO'}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-bold">
                            <span className="text-slate-400 uppercase tracking-tight">FROTA ALOCADA</span>
                            <span className="text-amber-600 flex items-center gap-1 font-black uppercase">
                              <Truck size={11} /> {work.trucksAssigned || 0} UNIDADES
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-blue-50/50 border border-blue-100 rounded-xl py-3 text-center">
                            <div className="text-[9px] text-blue-400 font-bold uppercase mb-1 tracking-tight">Cargas</div>
                            <div className="text-xl font-black text-blue-700 leading-none">{work.loads}</div>
                          </div>
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl py-3 text-center">
                            <div className="text-[9px] text-emerald-400 font-bold uppercase mb-1 tracking-tight">Volume</div>
                            <div className="text-xl font-black text-emerald-700 leading-none">{work.volume} m³</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 border-t border-slate-100 pt-3">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate italic">{work.address}</span>
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
