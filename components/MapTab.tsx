
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { OptimizationResult } from '../types';
import L from 'leaflet';
import { Map as MapIcon, Truck, Building2, MapPin } from 'lucide-react';

interface MapTabProps {
  data: OptimizationResult;
}

const MARKER_COLORS = [ '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316' ];

const createCustomIcon = (label: string | number, color: string, isSquare = false) => {
  return L.divIcon({
    className: 'custom-marker-container',
    html: `
      <div class="${isSquare ? 'rounded-md' : 'rounded-full'} border-2 border-white text-white flex items-center justify-center font-black shadow-xl text-[11px] relative z-10" 
           style="background-color: ${color}; width: 28px; height: 28px;">
        ${label}
      </div>
      ${!isSquare ? `<div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px]" style="border-t-color: ${color}; opacity: 0.9;"></div>` : ''}
    `,
    iconSize: [28, 35],
    iconAnchor: [14, 35],
    popupAnchor: [0, -32]
  });
};

const MapBounds: React.FC<{ works: any[]; branch: { lat: number, lng: number } }> = ({ works, branch }) => {
    const map = useMap();
    useEffect(() => {
        if (works.length > 0) {
            const points = works.map(w => [w.lat, w.lng] as [number, number]);
            if (branch) points.push([branch.lat, branch.lng]);
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [60, 60] });
        }
    }, [works, branch, map]);
    return null;
};

export const MapTab: React.FC<MapTabProps> = ({ data }) => {
    if (data.works.length === 0) return <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest opacity-50 h-full flex items-center justify-center">Nenhum plano gerado ainda</div>;
    const branchCoords: [number, number] = data.branchLocation ? [data.branchLocation.lat, data.branchLocation.lng] : [-26.89, -48.65];

    return (
        <div className="h-full flex flex-col relative">
            <style>{`.leaflet-div-icon { background: transparent !important; border: none !important; }`}</style>
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <MapIcon className="text-amber-500" size={20} /> Mapa Operacional
                </h2>
                <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 rounded-sm"></div> Usina</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> Obras</div>
                </div>
            </div>
            <div className="flex-1 relative z-0">
                <MapContainer center={branchCoords} zoom={12} style={{ height: '100%', width: '100%' }}>
                    <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapBounds works={data.works} branch={data.branchLocation || {lat: branchCoords[0], lng: branchCoords[1]}} />
                    
                    {/* Filial / Usina */}
                    <Marker position={branchCoords} icon={createCustomIcon('US', '#1e293b', true)}>
                        <Popup><strong>Usina de Concreto</strong><br/>Ponto de Saída da Frota</Popup>
                    </Marker>

                    {data.works.map((work, idx) => {
                        const markerColor = MARKER_COLORS[idx % MARKER_COLORS.length];
                        const trucks = work.trucksAssigned || 0;
                        const pump = work.pumpId || 'N/A';

                        return (
                            <React.Fragment key={work.id}>
                                <Polyline positions={[branchCoords, [work.lat, work.lng]]} pathOptions={{ color: markerColor, weight: 3, opacity: 0.4, dashArray: '5, 10' }} />
                                <Marker position={[work.lat, work.lng]} icon={createCustomIcon(idx + 1, markerColor)}>
                                    <Popup className="min-w-[220px]">
                                        <div className="p-1">
                                            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                                                <Building2 size={16} className="text-slate-400" />
                                                <h3 className="font-black text-slate-900 text-sm leading-tight">{work.name}</h3>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                                                        <span>Status da Bomba</span>
                                                        <span className="text-blue-600">{pump}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                                                        <span>Frota Mobilizada</span>
                                                        <span className="text-amber-600 flex items-center gap-1"><Truck size={12}/> {trucks} Unidades</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                    <div className="bg-blue-50 p-1.5 rounded border border-blue-100">
                                                        <div className="text-[9px] font-bold uppercase text-blue-400">Cargas</div>
                                                        <div className="text-sm font-black text-blue-700">{work.loads}</div>
                                                    </div>
                                                    <div className="bg-emerald-50 p-1.5 rounded border border-emerald-100">
                                                        <div className="text-[9px] font-bold uppercase text-emerald-400">Volume</div>
                                                        <div className="text-sm font-black text-emerald-700">{work.volume} m³</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-1 text-[10px] text-slate-400 italic pt-1">
                                                    <MapPin size={10} className="shrink-0 mt-0.5" />
                                                    {work.address}
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
};
