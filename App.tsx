
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { GanttTab } from './components/GanttTab';
import { BITableTab } from './components/BITableTab';
import { MapTab } from './components/MapTab';
import { LoginScreen } from './components/LoginScreen';
import { SimulationParams, OptimizationResult } from './types';
import { generateMockData } from './utils/mockSimulation';
import { LayoutDashboard, Clock, Map as MapIcon, Truck } from 'lucide-react';
import { supabase } from './supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gantt' | 'bi' | 'map'>('gantt');
  const [isRunning, setIsRunning] = useState(false);
  
  const [results, setResults] = useState<OptimizationResult>({ 
    schedule: [], 
    works: [], 
    summary: { totalTrips: 0, completionTime: '', efficiency: 0 } 
  });
  
  const [params, setParams] = useState<SimulationParams>({
    mode: 'optimizer',
    apiKey: '9bzBwwsjHfKmfIrrYpvtir7DbEjTUOj2vFWrAC72c4A',
    branchAddress: 'R. Geral Hugo de Almeida - Navegantes - SC',
    branchLat: '',
    branchLng: '',
    loadTime: 30,
    unloadTime: 10,
    totalTrucks: 27,
    truckCapacity: 8,
    totalPumps: 6,
    startDate: new Date().toISOString().split('T')[0],
    startTime: '05:00',
    generations: 120,
    popSize: 60,
    manualConstraints: []
  });

  // Check Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setTimeout(() => setIsInitialLoading(false), 800);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    try {
      const data = await generateMockData(params);
      setResults(data);
      setActiveTab('gantt');
    } catch (error) {
      console.error("Simulation failed:", error);
      alert("Ocorreu um erro durante a simulação.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setResults({ 
      schedule: [], 
      works: [], 
      summary: { totalTrips: 0, completionTime: '', efficiency: 0 } 
    });
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <div className="relative">
          <div className="w-24 h-24 bg-amber-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 animate-pulse">
            <Truck size={48} className="text-slate-900" />
          </div>
          <div className="absolute -inset-4 border-2 border-amber-500/20 rounded-3xl animate-ping opacity-20"></div>
        </div>
        <h2 className="text-white font-bold text-xl mt-8 tracking-wider">Concrete Router</h2>
        <p className="text-slate-500 text-xs uppercase tracking-[0.3em] mt-2 animate-pulse">Verificando Credenciais</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      <Sidebar 
        params={params} 
        setParams={setParams} 
        onRun={handleRunSimulation} 
        isRunning={isRunning}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
           <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
             <button
               onClick={() => setActiveTab('gantt')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'gantt' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Clock size={16} />
               Agenda Gantt
             </button>
             <button
               onClick={() => setActiveTab('bi')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'bi' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <LayoutDashboard size={16} />
               Dashboard BI
             </button>
             <button
               onClick={() => setActiveTab('map')}
               className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <MapIcon size={16} />
               Mapa de Rotas
             </button>
           </div>
           
           {results.summary.totalTrips > 0 && (
             <div className="flex gap-4 text-xs font-semibold bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">
               <span className="text-slate-400 mr-2 uppercase tracking-wider text-[10px]">
                 {params.mode === 'simulator' ? 'Simulação Manual' : 'Otimização Auto'}
               </span>
               <span>Viagens: {results.summary.totalTrips}</span>
               <span className="w-px h-4 bg-slate-300"></span>
               <span>Conclusão: {results.summary.completionTime}</span>
             </div>
           )}
        </div>

        <div className="flex-1 overflow-hidden relative bg-slate-50">
          {activeTab === 'gantt' && <GanttTab data={results} />}
          {activeTab === 'bi' && <BITableTab data={results} />}
          {activeTab === 'map' && <MapTab data={results} apiKey={params.apiKey} />}
        </div>
      </div>
    </div>
  );
};

export default App;
