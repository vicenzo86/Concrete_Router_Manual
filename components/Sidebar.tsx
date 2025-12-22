
import React, { useRef, useEffect, useMemo } from 'react';
import { SimulationParams, UploadedWork, WorkConstraint } from '../types';
import { Settings, Play, Truck, FileSpreadsheet, Sliders, Calculator, Zap, Trash2, Lock, Unlock, AlertTriangle, LogOut, MapPin, Building2, Key } from 'lucide-react';

// Declare global variable loaded via script tag in index.html
declare const readXlsxFile: any;

interface SidebarProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  onRun: () => void;
  isRunning: boolean;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ params, setParams, onRun, isRunning, onLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.uploadedData && params.uploadedData.length > 0) {
        setParams(prev => {
            const currentLen = prev.manualConstraints.length;
            const targetLen = (prev.uploadedData || []).length;
            if (targetLen !== currentLen) {
                const newConstraints: WorkConstraint[] = (prev.uploadedData || []).map((_, idx) => ({
                    workIndex: idx,
                    forcedTrucks: 4, 
                    forcedPumpId: (idx % prev.totalPumps) + 1,
                    forcedStartTime: prev.startTime,
                    locked: false
                }));
                return { ...prev, manualConstraints: newConstraints };
            }
            return prev;
        });
    }
  }, [params.uploadedData, params.totalPumps, params.startTime, setParams]);

  const totalManualTrucks = useMemo(() => {
      return params.manualConstraints.filter(c => c.locked).reduce((acc, c) => acc + c.forcedTrucks, 0);
  }, [params.manualConstraints]);

  const isOverCapacity = totalManualTrucks > params.totalTrucks;

  const handleChange = (field: keyof SimulationParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const handleConstraintChange = (index: number, field: keyof WorkConstraint, value: any) => {
      setParams(prev => {
          const newConstraints = [...prev.manualConstraints];
          newConstraints[index] = { ...newConstraints[index], [field]: value };
          return { ...prev, manualConstraints: newConstraints };
      });
  };

  const toggleLock = (index: number) => {
      setParams(prev => {
          const newConstraints = [...prev.manualConstraints];
          newConstraints[index] = { ...newConstraints[index], locked: !newConstraints[index].locked };
          return { ...prev, manualConstraints: newConstraints };
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const rows = await readXlsxFile(file);
        if (rows.length < 2) return;
        
        const headers = rows[0].map((h: any) => h?.toString().toLowerCase() || '');
        const coordIdx = headers.findIndex((h: string) => h.includes('coord'));
        const loadsIdx = headers.findIndex((h: string) => h.includes('carga') && h.includes('inic'));
        const addrIdx = headers.findIndex((h: string) => h.includes('endereco') || h.includes('obra'));

        const parsedData: UploadedWork[] = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 1) continue;
            
            let loads = Number(row[loadsIdx !== -1 ? loadsIdx : 0]) || 0;
            let address = row[addrIdx !== -1 ? addrIdx : (loadsIdx === 0 ? 1 : 0)]?.toString() || '';
            let lat: number | undefined;
            let lng: number | undefined;

            if (coordIdx !== -1 && row[coordIdx]) {
                const parts = row[coordIdx].toString().split(',');
                if (parts.length === 2) {
                    lat = parseFloat(parts[0]);
                    lng = parseFloat(parts[1]);
                }
            }

            if (loads > 0 && (address || lat)) {
                parsedData.push({ loads, address, lat, lng });
            }
        }
        
        if (parsedData.length > 0) {
            setParams(prev => ({ 
                ...prev, 
                uploadedData: parsedData,
                manualConstraints: parsedData.map((_, idx) => ({
                    workIndex: idx,
                    forcedTrucks: 4,
                    forcedPumpId: (idx % prev.totalPumps) + 1,
                    forcedStartTime: prev.startTime,
                    locked: false
                }))
            }));
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao ler Excel. Verifique o formato.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isUsingUploadedData = params.uploadedData && params.uploadedData.length > 0;

  return (
    <div className="w-80 bg-slate-900 text-white flex flex-col h-full border-r border-slate-700 shadow-xl z-20 overflow-hidden">
      <div className="p-5 border-b border-slate-700 bg-slate-900 z-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Truck className="text-amber-500" />
            Concrete Router
          </h1>
          {onLogout && (
            <button onClick={onLogout} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          )}
        </div>
        
        <div className="bg-slate-800 p-1 rounded-lg flex relative">
            <button onClick={() => handleChange('mode', 'optimizer')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all z-10 ${params.mode === 'optimizer' ? 'text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                <Zap size={14} /> Auto
            </button>
            <button onClick={() => handleChange('mode', 'simulator')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all z-10 ${params.mode === 'simulator' ? 'text-slate-900' : 'text-slate-400 hover:text-white'}`}>
                <Sliders size={14} /> Sim
            </button>
            <div className={`absolute top-1 bottom-1 w-1/2 bg-amber-500 rounded shadow transition-all duration-300 ${params.mode === 'simulator' ? 'translate-x-full' : 'translate-x-0'}`}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        
        {/* NOVA SEÇÃO: CONFIGURAÇÃO DA USINA */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-2">
             <MapPin size={12} className="text-indigo-400" /> Configuração da Usina
          </h2>
          <div className="space-y-3 bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <Key size={10} /> HERE API Key
              </label>
              <input 
                type="password" 
                value={params.apiKey} 
                onChange={(e) => handleChange('apiKey', e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-amber-200"
                placeholder="Sua Chave API"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                <Building2 size={10} /> Endereço da Usina
              </label>
              <textarea 
                rows={2}
                value={params.branchAddress} 
                onChange={(e) => handleChange('branchAddress', e.target.value)} 
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs resize-none"
                placeholder="Digite o endereço de saída..."
              />
            </div>
          </div>
        </div>

        {/* PARÂMETROS OPERACIONAIS */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-2">
             <Settings size={12} /> Parâmetros de Operação
          </h2>
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Total Bombas</label>
                <input type="number" min="1" value={params.totalPumps} onChange={(e) => handleChange('totalPumps', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Total Frota</label>
                <input type="number" min="1" value={params.totalTrucks} onChange={(e) => handleChange('totalTrucks', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Capacidade (m³)</label>
                <input type="number" min="1" value={params.truckCapacity} onChange={(e) => handleChange('truckCapacity', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Data</label>
                <input type="date" value={params.startDate} onChange={(e) => handleChange('startDate', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Carga (min)</label>
                <input type="number" min="1" value={params.loadTime} onChange={(e) => handleChange('loadTime', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase">Descarga (min)</label>
                <input type="number" min="1" value={params.unloadTime} onChange={(e) => handleChange('unloadTime', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
             </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Hora Inicio Operação</label>
            <input type="time" value={params.startTime} onChange={(e) => handleChange('startTime', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs" />
          </div>
        </div>

        {/* PLANILHA DE OBRAS */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase text-amber-500 tracking-wider flex items-center gap-1">
                    <Calculator size={12} /> {isUsingUploadedData ? 'Obras Carregadas' : 'Obras Disponíveis'}
                </h2>
                {isUsingUploadedData && ( <button onClick={() => handleChange('uploadedData', undefined)} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={10} /> Limpar</button> )}
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs font-bold transition-colors">
                <FileSpreadsheet size={14} className="text-emerald-500" />
                Importar Planilha (.xlsx)
            </button>

            <div className="bg-slate-800 rounded border border-slate-700 p-1 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {(isUsingUploadedData ? params.uploadedData : []).map((item: any, idx) => {
                    const constraint = params.manualConstraints[idx];
                    if (!constraint) return null;
                    return (
                        <div key={idx} className={`p-2 rounded border text-xs transition-all ${constraint.locked ? 'bg-slate-900 border-amber-500 shadow-md scale-[1.02]' : 'bg-slate-800/50 border-slate-700 opacity-80'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <div className={`font-bold truncate w-4/5 ${constraint.locked ? 'text-amber-400' : 'text-slate-400'}`}>{item.address}</div>
                                <button onClick={() => toggleLock(idx)} className={`p-1 rounded hover:bg-slate-700 ${constraint.locked ? 'text-amber-500' : 'text-slate-600'}`}>
                                    {constraint.locked ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                            </div>
                            {constraint.locked && (
                                <div className="grid grid-cols-3 gap-1.5 animate-in fade-in slide-in-from-top-1">
                                    <div>
                                        <label className="text-[9px] text-slate-500 block mb-0.5 uppercase font-bold">Frota</label>
                                        <input type="number" min="1" value={constraint.forcedTrucks} onChange={(e) => handleConstraintChange(idx, 'forcedTrucks', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white text-[11px]" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-500 block mb-0.5 uppercase font-bold">Bomba</label>
                                        <input type="number" min="1" max={params.totalPumps} value={constraint.forcedPumpId} onChange={(e) => handleConstraintChange(idx, 'forcedPumpId', Number(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white text-[11px]" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-500 block mb-0.5 uppercase font-bold">Início</label>
                                        <input type="time" value={constraint.forcedStartTime} onChange={(e) => handleConstraintChange(idx, 'forcedStartTime', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white text-[11px]" />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {isOverCapacity && (
                <div className="bg-red-900/40 border border-red-500/50 p-2 rounded flex items-start gap-2 text-[10px] text-red-200">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <div><strong>Erro:</strong> Frotas travadas ({totalManualTrucks}) excedem o total ({params.totalTrucks}).</div>
                </div>
            )}
        </div>

        <button onClick={onRun} disabled={isRunning || isOverCapacity} className={`w-full py-4 px-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 mt-auto uppercase tracking-widest ${ isRunning ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-900 shadow-amber-500/20' }`}>
          {isRunning ? ( <><Settings className="animate-spin" size={18} /> Calculando... </> ) : ( <><Play size={18} /> Otimizar Rotas </> )}
        </button>
      </div>
    </div>
  );
};
