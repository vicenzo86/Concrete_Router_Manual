
import React from 'react';
import { OptimizationResult } from '../types';
import { Clock, Hammer, Truck } from 'lucide-react';

interface GanttTabProps {
  data: OptimizationResult;
}

const PUMP_COLORS: Record<string, string> = {
  'BOMBA-1': '#3b82f6', // Azul
  'BOMBA-2': '#f97316', // Laranja
  'BOMBA-3': '#10b981', // Verde
  'BOMBA-4': '#ef4444', // Vermelho
  'BOMBA-5': '#8b5cf6', // Roxo
  'BOMBA-6': '#ec4899', // Rosa
};

export const GanttTab: React.FC<GanttTabProps> = ({ data }) => {
  if (data.schedule.length === 0) return <div className="p-10 text-center text-slate-500 font-medium">Inicie a simulação para visualizar o cronograma.</div>;

  const firstStart = Math.min(...data.schedule.map(s => s.startTime.getTime()));
  const lastEnd = Math.max(...data.schedule.map(s => s.endTime.getTime()));
  
  const startTime = new Date(firstStart - 30 * 60000); // 30min margem inicial
  const endTime = new Date(lastEnd + 60 * 60000);   // 1h margem final
  const totalDuration = endTime.getTime() - startTime.getTime();

  const getLeft = (date: Date) => `${((date.getTime() - startTime.getTime()) / totalDuration) * 100}%`;
  const getWidth = (start: Date, end: Date) => `${((end.getTime() - start.getTime()) / totalDuration) * 100}%`;

  const hours: Date[] = [];
  for (let t = new Date(startTime).setMinutes(0,0,0); t <= endTime.getTime(); t += 3600000) {
    hours.push(new Date(t));
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Clock className="text-blue-600" size={20} />
          Gantt Operacional (Modelo Determinístico)
        </h2>
        <div className="flex gap-4">
          {Object.entries(PUMP_COLORS).slice(0, data.works.length).map(([id, color]) => (
            <div key={id} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
              {id}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
        <div className="min-w-[1500px] relative">
          {/* Header de Tempo */}
          <div className="flex mb-8 sticky top-0 bg-transparent z-20 pb-2 border-b border-slate-200">
            <div className="w-64 font-bold text-slate-400 text-[10px] uppercase tracking-widest pl-2">Local / Bomba</div>
            <div className="flex-1 relative h-6">
              {hours.map((h, i) => (
                <div key={i} className="absolute text-[10px] font-bold text-slate-500 transform -translate-x-1/2 flex flex-col items-center" style={{ left: getLeft(h) }}>
                  <span>{h.getHours().toString().padStart(2, '0')}:00</span>
                  <div className="h-2 w-px bg-slate-300 mt-1"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Linhas das Obras */}
          <div className="space-y-6">
            {data.works.map((work) => {
              const loads = data.schedule.filter(s => s.workId === work.id && s.status === 'unloading');
              if (loads.length === 0) return null;
              
              const pumpId = loads[0].pumpId;
              const color = PUMP_COLORS[pumpId] || '#94a3b8';

              return (
                <div key={work.id} className="flex items-center group">
                  <div className="w-64 pr-6">
                    <div className="font-extrabold text-slate-800 text-sm truncate">{work.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="px-2 py-0.5 rounded text-[9px] font-black text-white uppercase shadow-sm" style={{ backgroundColor: color }}>
                         {pumpId}
                       </span>
                       <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                         <Truck size={12} className="text-slate-400" /> {work.trucksAssigned} Cams
                       </span>
                    </div>
                  </div>

                  <div className="flex-1 relative h-10 bg-white/50 rounded-lg border border-slate-200 shadow-sm overflow-hidden group-hover:border-slate-300 transition-all">
                    {/* Linhas de Grade */}
                    {hours.map((h, i) => (
                      <div key={i} className="absolute h-full w-px bg-slate-100 top-0" style={{ left: getLeft(h) }} />
                    ))}

                    {/* Blocos Fragmentados de Carga */}
                    {loads.map((load, idx) => (
                      <div
                        key={idx}
                        className="absolute h-6 top-2 rounded shadow-sm flex items-center justify-center cursor-help transition-transform hover:scale-y-125 z-10"
                        style={{
                          left: getLeft(load.startTime),
                          width: getWidth(load.startTime, load.endTime),
                          backgroundColor: color,
                          borderLeft: '1px solid rgba(255,255,255,0.3)'
                        }}
                        title={`${load.truckId} | Carga #${load.loadNumber}\nInício: ${load.startTime.toLocaleTimeString()}\nTérmino: ${load.endTime.toLocaleTimeString()}`}
                      >
                        <span className="text-[7px] font-black text-white px-0.5 truncate">
                          {load.truckId.split('-').pop()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
