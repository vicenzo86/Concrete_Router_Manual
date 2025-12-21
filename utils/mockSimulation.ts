
import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite, WorkConstraint } from '../types';

/**
 * Utilitários de data e tempo
 */
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + Math.round(minutes) * 60000);

const parseTimeToMinutes = (timeStr: string, baseStartTime: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  const [bh, bm] = baseStartTime.split(':').map(Number);
  return (h * 60 + m) - (bh * 60 + bm);
};

/**
 * Geocodificação via HERE Search API v7
 * Refinado para garantir que endereços parciais encontrem a região correta.
 */
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number, lng: number } | null> {
  if (!apiKey || !address || address.length < 3) return null;
  try {
    // Adiciona contexto regional se o endereço for muito curto ou não especificar cidade/estado
    const query = address.toLowerCase().includes('sc') || address.toLowerCase().includes('santa catarina') 
      ? address 
      : `${address}, Navegantes, SC, Brasil`;

    const encodedAddr = encodeURIComponent(query);
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodedAddr}&apiKey=${apiKey}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items[0].position;
    }
  } catch (e) {
    console.error("Erro na geocodificação HERE:", e);
  }
  return null;
}

/**
 * Cálculo de tempo de viagem usando HERE Routing API v8
 */
async function getTravelTimeReal(from: { lat: number, lng: number }, to: { lat: number, lng: number }, apiKey: string): Promise<number> {
  if (!apiKey || apiKey.length < 10) {
    // Fallback: Haversine
    const R = 6371;
    const dLat = (to.lat - from.lat) * (Math.PI / 180);
    const dLon = (to.lng - from.lng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(from.lat * (Math.PI / 180)) * Math.cos(to.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 15 + (R * c * 3.0); // 15 min base + 3 min/km
  }

  try {
    const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&return=summary&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const seconds = data.routes[0].sections[0].summary.duration;
      return (seconds / 60) + 10; // +10 min manobra
    }
  } catch (e) {
    console.error("Erro na consulta de rotas HERE:", e);
  }
  return 35; 
}

export const generateMockData = async (params: SimulationParams): Promise<OptimizationResult> => {
  const branchCoords = { 
    lat: params.branchLat ? parseFloat(params.branchLat) : -26.8955, 
    lng: params.branchLng ? parseFloat(params.branchLng) : -48.6757 
  };

  // 1. Processamento das Obras (Geocodificação + Cálculo de Tempo)
  const worksPromises = (params.uploadedData || []).map(async (item, i) => {
    let coords = item.lat && item.lng ? { lat: item.lat, lng: item.lng } : null;
    if (!coords) {
      coords = await geocodeAddress(item.address, params.apiKey);
    }
    
    // Se a geocodificação falhar, usamos um spread um pouco maior para não clusterizar tudo no mesmo ponto
    const lat = coords?.lat || (branchCoords.lat + (Math.sin(i) * 0.04));
    const lng = coords?.lng || (branchCoords.lng + (Math.cos(i) * 0.04));
    
    const ida = await getTravelTimeReal(branchCoords, { lat, lng }, params.apiKey);
    const tempoUnit = params.loadTime + (2 * ida) + params.unloadTime;
    
    return {
      index: i,
      id: `W-${i + 1}`,
      name: item.address,
      address: item.address,
      volume: item.loads * params.truckCapacity,
      loads: item.loads,
      cargasRestantes: item.loads,
      lat,
      lng,
      trucksAssigned: 0,
      tempoUnitEst: tempoUnit,
      tempoTotalEst: tempoUnit * item.loads,
      pumpId: null as string | null,
      finished: false,
      manualConstraint: params.manualConstraints.find(c => c.workIndex === i)
    };
  });

  let works = await Promise.all(worksPromises);
  if (works.length === 0) return { schedule: [], works: [], summary: { totalTrips: 0, completionTime: '00:00', efficiency: 0 } };

  // Priorização
  works.sort((a, b) => {
    const aLocked = a.manualConstraint?.locked;
    const bLocked = b.manualConstraint?.locked;
    if (aLocked && !bLocked) return -1;
    if (!aLocked && bLocked) return 1;
    if (aLocked && bLocked) {
      const aTime = parseTimeToMinutes(a.manualConstraint!.forcedStartTime, params.startTime);
      const bTime = parseTimeToMinutes(b.manualConstraint!.forcedStartTime, params.startTime);
      return aTime - bTime;
    }
    return b.tempoTotalEst - a.tempoTotalEst;
  });

  const [year, month, day] = params.startDate.split('-').map(Number);
  const [sh, sm] = params.startTime.split(':').map(Number);
  const startDateTime = new Date(year, month - 1, day, sh, sm, 0, 0);

  // Distribuição de Frota
  const totalTrucksAvailable = params.totalTrucks;
  const forcedWorks = works.filter(o => o.manualConstraint?.locked);
  const totalForcedTrucks = forcedWorks.reduce((acc, o) => acc + (o.manualConstraint?.forcedTrucks || 0), 0);
  const remainingTrucks = Math.max(0, totalTrucksAvailable - totalForcedTrucks);
  const variableWorks = works.filter(o => !o.manualConstraint?.locked).slice(0, Math.max(0, params.totalPumps - forcedWorks.length));
  const totalWeightVariable = variableWorks.reduce((acc, o) => acc + o.tempoTotalEst, 0);

  let distributedVariable = 0;
  works.forEach(obra => {
      if (obra.manualConstraint?.locked) {
          obra.trucksAssigned = obra.manualConstraint.forcedTrucks;
      } else if (variableWorks.some(vw => vw.id === obra.id) && totalWeightVariable > 0) {
          const share = Math.floor(remainingTrucks * (obra.tempoTotalEst / totalWeightVariable));
          obra.trucksAssigned = Math.max(1, share);
          distributedVariable += obra.trucksAssigned;
      } else {
          obra.trucksAssigned = 0;
      }
  });

  if (distributedVariable < remainingTrucks && variableWorks.length > 0) {
      const firstVar = works.find(o => o.id === variableWorks[0].id);
      if (firstVar) firstVar.trucksAssigned += (remainingTrucks - distributedVariable);
  }

  // Simulação
  const schedule: ScheduleItem[] = [];
  const bombas = Array.from({ length: params.totalPumps }).map((_, i) => ({
    id: i + 1,
    availableMinutes: 0,
    coords: branchCoords
  }));

  const worksQueue = [...works];
  while (worksQueue.some(o => !o.finished)) {
    bombas.sort((a, b) => a.availableMinutes - b.availableMinutes);
    const b = bombas[0];
    const now = b.availableMinutes;

    const workIdx = worksQueue.findIndex(o => {
      if (o.finished) return false;
      if (o.manualConstraint?.locked) {
        if (o.manualConstraint.forcedPumpId !== b.id) return false;
        const startMin = parseTimeToMinutes(o.manualConstraint.forcedStartTime, params.startTime);
        return now >= startMin;
      }
      return true;
    });

    if (workIdx === -1) {
      b.availableMinutes += 5;
      if (b.availableMinutes > 1440) break; 
      continue;
    }

    const obra = worksQueue[workIdx];
    if (!obra.trucksAssigned || obra.trucksAssigned === 0) {
        obra.trucksAssigned = Math.max(1, Math.floor(params.totalTrucks / params.totalPumps));
    }

    const ida = (obra.tempoUnitEst - params.loadTime - params.unloadTime) / 2;
    const interval = obra.tempoUnitEst / Math.max(1, obra.trucksAssigned);
    
    let baseTime = now;
    if (obra.manualConstraint?.locked) {
        const forcedStartMin = parseTimeToMinutes(obra.manualConstraint.forcedStartTime, params.startTime);
        baseTime = Math.max(now, forcedStartMin);
    }

    let lastEnd = baseTime + ida;
    for (let c = 0; c < obra.loads; c++) {
      const arriveTime = baseTime + ida + (c * interval);
      const startUnload = Math.max(arriveTime, lastEnd);
      const endUnload = startUnload + params.unloadTime;
      schedule.push({
        id: `${obra.id}-L${c + 1}`,
        workId: obra.id,
        truckId: `C${100 + Math.floor(Math.random() * 899)}`,
        pumpId: `BOMBA-${b.id}`,
        loadNumber: c + 1,
        startTime: addMinutes(startDateTime, startUnload),
        endTime: addMinutes(startDateTime, endUnload),
        status: 'unloading'
      });
      lastEnd = endUnload;
    }

    obra.finished = true;
    b.availableMinutes = lastEnd;
    obra.pumpId = `BOMBA-${b.id}`;
  }

  const finalEnd = schedule.length > 0 ? Math.max(...schedule.map(s => s.endTime.getTime())) : startDateTime.getTime();

  return {
    schedule: schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    works: works as any[],
    branchLocation: branchCoords,
    summary: {
      totalTrips: schedule.length,
      completionTime: new Date(finalEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      efficiency: 0.94
    }
  };
};
