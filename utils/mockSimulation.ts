
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
 * Cálculo de distância real via Haversine
 */
function getDistanceFromLatLonInKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

function getTravelTime(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const dist = getDistanceFromLatLonInKm(from.lat, from.lng, to.lat, to.lng);
  return 15 + (dist * 2.5); // 15 min fixo + 2.5 min/km
}

export const generateMockData = async (params: SimulationParams): Promise<OptimizationResult> => {
  const branchCoords = { 
    lat: params.branchLat ? parseFloat(params.branchLat) : -26.8955, 
    lng: params.branchLng ? parseFloat(params.branchLng) : -48.6757 
  };

  // 1. Preparação
  let works = (params.uploadedData || []).map((item, i) => {
    const lat = item.lat || (-26.89 + (Math.random() * 0.08 - 0.04));
    const lng = item.lng || (-48.67 + (Math.random() * 0.08 - 0.04));
    const ida = getTravelTime(branchCoords, { lat, lng });
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

  if (works.length === 0) return { schedule: [], works: [], summary: { totalTrips: 0, completionTime: '00:00', efficiency: 0 } };

  // PRIORIZAÇÃO CRÍTICA: 
  // 1º Obras Travadas (Sorted por horário de início)
  // 2º Obras Livres (Sorted por tempo de ciclo total descendente)
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

  // 2. Distribuição da Frota
  const totalTrucks = params.totalTrucks;
  const numBombas = params.totalPumps;
  
  const bombas = Array.from({ length: numBombas }).map((_, i) => ({
    id: i + 1,
    availableMinutes: 0,
    caminhoes: 0,
    coords: branchCoords
  }));

  const lockedWorks = works.filter(o => o.manualConstraint?.locked);
  const totalForcedTrucks = lockedWorks.reduce((acc, o) => acc + (o.manualConstraint?.forcedTrucks || 0), 0);
  const availableFleetForVariable = Math.max(0, totalTrucks - totalForcedTrucks);

  const variableWorks = works.filter(o => !o.manualConstraint?.locked).slice(0, Math.max(0, numBombas - lockedWorks.length));
  const totalWeightVariable = variableWorks.reduce((acc, o) => acc + o.tempoTotalEst, 0);

  let allocatedVariable = 0;
  
  works.forEach(obra => {
      if (obra.manualConstraint?.locked) {
          obra.trucksAssigned = obra.manualConstraint.forcedTrucks;
      } else {
          const isAmongInitial = variableWorks.some(vw => vw.id === obra.id);
          if (isAmongInitial && totalWeightVariable > 0) {
              const share = Math.floor(availableFleetForVariable * (obra.tempoTotalEst / totalWeightVariable));
              obra.trucksAssigned = Math.max(1, share);
              allocatedVariable += obra.trucksAssigned;
          } else {
              obra.trucksAssigned = 0; 
          }
      }
  });

  if (allocatedVariable !== availableFleetForVariable && variableWorks.length > 0) {
      const diff = availableFleetForVariable - allocatedVariable;
      const firstVar = works.find(o => o.id === variableWorks[0].id);
      if (firstVar) firstVar.trucksAssigned = Math.max(1, (firstVar.trucksAssigned || 0) + diff);
  }

  // 3. Simulação
  const schedule: ScheduleItem[] = [];
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
        obra.trucksAssigned = Math.max(1, Math.floor(totalTrucks / numBombas));
    }

    const ida = getTravelTime(branchCoords, { lat: obra.lat, lng: obra.lng });
    const cycleTime = obra.tempoUnitEst;
    const interval = cycleTime / Math.max(1, obra.trucksAssigned);
    
    // Respeito ao horário de início forçado se for a primeira carga na bomba para esta obra
    let operationalStart = now;
    if (obra.manualConstraint?.locked) {
        const forcedStartMin = parseTimeToMinutes(obra.manualConstraint.forcedStartTime, params.startTime);
        operationalStart = Math.max(now, forcedStartMin);
    }

    let lastUnloadFinish = operationalStart + ida;

    for (let c = 0; c < obra.loads; c++) {
      const arriveTime = operationalStart + ida + (c * interval);
      const startUnload = Math.max(arriveTime, lastUnloadFinish);
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

      lastUnloadFinish = endUnload;
    }

    obra.finished = true;
    obra.pumpId = `BOMBA-${b.id}`;
    b.availableMinutes = lastUnloadFinish;
    b.coords = { lat: obra.lat, lng: obra.lng };
  }

  const finalEnd = schedule.length > 0 ? Math.max(...schedule.map(s => s.endTime.getTime())) : startDateTime.getTime();

  return {
    schedule: schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    works: works as any[],
    branchLocation: branchCoords,
    summary: {
      totalTrips: schedule.length,
      completionTime: new Date(finalEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      efficiency: 0.92
    }
  };
};
