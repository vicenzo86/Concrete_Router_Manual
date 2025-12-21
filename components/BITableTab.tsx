
import React from 'react';
import { OptimizationResult } from '../types';
import { Table, Download, Truck } from 'lucide-react';

declare const XLSX: any;

interface BITableTabProps {
  data: OptimizationResult;
}

const PUMP_COLORS: Record<string, string> = {
  'BOMBA-1': 'bg-purple-100 text-purple-600 border-purple-200',
  'BOMBA-2': 'bg-pink-100 text-pink-600 border-pink-200',
  'BOMBA-3': 'bg-indigo-100 text-indigo-600 border-indigo-200',
  'BOMBA-4': 'bg-blue-100 text-blue-600 border-blue-200',
  'BOMBA-5': 'bg-amber-100 text-amber-600 border-amber-200',
  'BOMBA-6': 'bg-emerald-100 text-emerald-600 border-emerald-200',
};

export const BITableTab: React.FC<BITableTabProps> = ({ data }) => {
  if (data.works.length === 0) return <div className="p-10 text-center text-slate-500">Sem dados. Execute a simulação para visualizar o dashboard.</div>;

  const rows = data.works.map(work => {
    const workItems = data.schedule.filter(s => s.workId === work.id);
    if (workItems.length === 0) return null;

    const sortedItems = [...workItems].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const startTime = sortedItems[0].startTime;
    const endTime = sortedItems[sortedItems.length - 1].endTime;
    const pumpId = sortedItems[0].pumpId;

    return {
      workId: work.id,
      name: work.name,
      address: work.address,
      startTime,
      endTime,
      pumpId,
      loads: work.loads,
      volume: work.volume,
      trucks: work.trucksAssigned || 0
    };
  }).filter(Boolean);

  const formatDateTime = (date: Date) => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}, ${h}:${min}`;
  };

  const handleExport = () => {
    if (typeof XLSX === 'undefined') return alert("Biblioteca de exportação não carregada.");
    const wb = XLSX.utils.book_new();
    const exportData = rows.map(r => ({
        "OBRA": r?.name,
        "BOMBA": r?.pumpId,
        "INICIO": formatDateTime(r!.startTime),
        "TERMINO": formatDateTime(r!.endTime),
        "FROTA": r?.trucks,
        "CARGAS": r?.loads,
        "VOLUME (m3)": r?.volume
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportData), "Planejamento");
    XLSX.writeFile(wb, `Plano_Concreto_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
          <Table className="text-slate-700" size={24} /> Performance Dashboard
        </h2>
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm text-sm font-bold transition-all transform active:scale-95">
          <Download size={16} /> Export Excel
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-5">Work Name</th>
                <th className="px-6 py-5">Pump Slot</th>
                <th className="px-6 py-5">Start Time</th>
                <th className="px-6 py-5">End Time</th>
                <th className="px-6 py-5">Frota (Caminhões)</th>
                <th className="px-6 py-5 text-center">Cargas</th>
                <th className="px-6 py-5 text-right">Volume (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-5 font-semibold text-slate-700">{row?.name}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${PUMP_COLORS[row!.pumpId] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {row?.pumpId.replace('BOMBA-', 'Bomba ')}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-medium text-xs">
                    {formatDateTime(row!.startTime)}
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-medium text-xs">
                    {formatDateTime(row!.endTime)}
                  </td>
                  <td className="px-6 py-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-[11px] font-bold">
                      <Truck size={14} className="opacity-70" /> {row?.trucks} Unidades
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center font-bold text-slate-600 text-xs">{row?.loads}</td>
                  <td className="px-6 py-5 text-right font-black text-slate-800 text-sm">{row?.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
