
import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

/**
 * Utilitários de Geocodificação e Rotas (HERE API)
 */
async function getCoordinates(address: string, apiKey: string): Promise<{lat: number, lng: number} | null> {
  if (!apiKey || !address || address.length < 5) return null;
  try {
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKey}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) return data.items[0].position;
  } catch (e) {
    console.warn("Falha ao geocodificar:", address);
  }
  return null;
}

async function getTravelTime(orig: {lat: number, lng: number}, dest: {lat: number, lng: number}, apiKey: string): Promise<number> {
  if (!apiKey) {
    const dist = Math.sqrt(Math.pow(dest.lat - orig.lat, 2) + Math.pow(dest.lng - orig.lng, 2)) * 111;
    return 15 + (dist * 2.2);
  }
  try {
    const url = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${orig.lat},${orig.lng}&destination=${dest.lat},${dest.lng}&return=summary&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].sections[0].summary.duration / 60;
    }
  } catch (e) {
    console.warn("Falha ao calcular rota real, usando estimativa.");
  }
  const dist = Math.sqrt(Math.pow(dest.lat - orig.lat, 2) + Math.pow(dest.lng - orig.lng, 2)) * 111;
  return 15 + (dist * 2.2);
}

export const generateMockData = async (params: SimulationParams): Promise<OptimizationResult> => {
  const branchCoords = await getCoordinates(params.branchAddress, params.apiKey) || { lat: -26.8955, lng: -48.6757 };
  const obrasRaw = params.uploadedData || [];
  
  // Mapeamento inicial das obras
  const obras: any[] = await Promise.all(obrasRaw.map(async (item, i) => {
    const coords = (item.lat && item.lng) ? { lat: item.lat, lng: item.lng } : await getCoordinates(item.address, params.apiKey);
    const lat = coords?.lat || (branchCoords.lat + (Math.sin(i * 1.5) * 0.02));
    const lng = coords?.lng || (branchCoords.lng + (Math.cos(i * 1.5) * 0.02));
    const ida = await getTravelTime(branchCoords, { lat, lng }, params.apiKey);
    const tempoUnitEst = params.loadTime + (2 * ida) + params.unloadTime;

    return {
      id: `W-${i + 1}`,
      index: i,
      name: item.address,
      address: item.address,
      lat,
      lng,
      loads: item.loads,
      cargasRestantes: item.loads,
      tempoUnitEst,
      tempoTotalEst: tempoUnitEst * item.loads,
      travelTime: ida,
      volume: item.loads * params.truckCapacity,
      trucksAssigned: 0,
      manualConstraint: params.manualConstraints.find(c => c.workIndex === i)
    };
  }));

  if (obras.length === 0) return { schedule: [], works: [], summary: { totalTrips: 0, completionTime: '00:00', efficiency: 0 } };

  const [year, month, day] = params.startDate.split('-').map(Number);
  const [sh, sm] = params.startTime.split(':').map(Number);
  const startDateTime = new Date(year, month - 1, day, sh, sm, 0, 0);

  // Inicialização das bombas
  const bombas = Array.from({ length: params.totalPumps }).map((_, i) => ({
    id: i + 1,
    availableMinutes: 0,
    coords: branchCoords,
    currentWork: null as any,
    busyUntil: 0,
    trucksUsed: 0
  }));

  const schedule: ScheduleItem[] = [];
  const obrasPendentes = [...obras];

  // Função auxiliar para converter "HH:MM" em minutos relativos ao início
  const getRelativeMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const [baseH, baseM] = params.startTime.split(':').map(Number);
    return (h * 60 + m) - (baseH * 60 + baseM);
  };

  // Loop de simulação determinística
  while (obrasPendentes.some(o => o.cargasRestantes > 0)) {
    bombas.sort((a, b) => a.availableMinutes - b.availableMinutes);
    const b = bombas[0];
    const nowMinutes = b.availableMinutes;

    // 1. Identifica e ORDENA obras por prioridade de HORÁRIO e TRAVAMENTO
    const obrasParaAtender = obrasPendentes
      .filter(o => o.cargasRestantes > 0 && !bombas.some(b2 => b2.currentWork?.id === o.id))
      .sort((a, b) => {
        const aLocked = a.manualConstraint?.locked;
        const bLocked = b.manualConstraint?.locked;
        
        // Prioridade 1: Obras Travadas vão primeiro
        if (aLocked && !bLocked) return -1;
        if (!aLocked && bLocked) return 1;

        // Prioridade 2: Se ambas forem travadas (ou ambas não), decide pelo horário (forcedStartTime)
        if (aLocked && bLocked) {
          const aMins = getRelativeMinutes(a.manualConstraint!.forcedStartTime);
          const bMins = getRelativeMinutes(b.manualConstraint!.forcedStartTime);
          if (aMins !== bMins) return aMins - bMins;
        }

        // Prioridade 3: Se empatar no horário ou não houver trava, usa a importância (tamanho)
        return b.tempoTotalEst - a.tempoTotalEst;
      });

    if (obrasParaAtender.length === 0) {
      b.availableMinutes += 5;
      if (nowMinutes > 1440) break;
      continue;
    }

    const o = obrasParaAtender[0];

    // Ajuste de tempo de início: Se a obra está travada para um horário futuro, 
    // a bomba deve esperar ou o início deve ser postergado para o horário alvo.
    let targetStartMins = 0;
    if (o.manualConstraint?.locked) {
      targetStartMins = Math.max(0, getRelativeMinutes(o.manualConstraint.forcedStartTime));
    }
    
    // O início real é o máximo entre quando a bomba libera e o horário solicitado
    const effectiveNowMinutes = Math.max(nowMinutes, targetStartMins);

    // LÓGICA DE FROTA DINÂMICA
    const trucksOccupied = bombas
      .filter(otherB => otherB.id !== b.id && otherB.busyUntil > effectiveNowMinutes)
      .reduce((sum, otherB) => sum + otherB.trucksUsed, 0);

    const availableGlobal = Math.max(1, params.totalTrucks - trucksOccupied);

    let numCaminhoes: number;
    if (o.manualConstraint?.locked) {
      numCaminhoes = Math.min(o.manualConstraint.forcedTrucks, params.totalTrucks);
    } else {
      const bombasLivres = bombas.filter(otherB => otherB.busyUntil <= effectiveNowMinutes).length;
      numCaminhoes = Math.max(1, Math.floor(availableGlobal / Math.max(1, bombasLivres)));
    }

    numCaminhoes = Math.min(numCaminhoes, availableGlobal);

    const ida = await getTravelTime(b.coords, { lat: o.lat, lng: o.lng }, params.apiKey);
    const tempoUnit = params.loadTime + (2 * ida) + params.unloadTime;
    
    o.trucksAssigned = numCaminhoes;
    o.pumpId = `BOMBA-${b.id}`;

    const duracaoTotal = (tempoUnit * o.cargasRestantes) / numCaminhoes;
    const inicioMinutos = effectiveNowMinutes + ida;
    const fimMinutos = inicioMinutos + duracaoTotal;

    const intervalo = tempoUnit / numCaminhoes;
    for (let c = 0; c < o.cargasRestantes; c++) {
      const startLoad = inicioMinutos + (c * intervalo);
      schedule.push({
        id: `${o.id}-L${c + 1}`,
        workId: o.id,
        truckId: `C-${b.id}-${(c % numCaminhoes) + 1}`,
        pumpId: `BOMBA-${b.id}`,
        loadNumber: c + 1,
        startTime: new Date(startDateTime.getTime() + startLoad * 60000),
        endTime: new Date(startDateTime.getTime() + (startLoad + params.unloadTime) * 60000),
        status: 'unloading'
      });
    }

    b.availableMinutes = fimMinutos;
    b.busyUntil = fimMinutos;
    b.trucksUsed = numCaminhoes;
    b.coords = { lat: o.lat, lng: o.lng };
    b.currentWork = o;
    o.cargasRestantes = 0;

    if (nowMinutes > 2880) break;
  }

  const finalEndTime = schedule.length > 0 ? Math.max(...schedule.map(s => s.endTime.getTime())) : startDateTime.getTime();

  return {
    schedule: schedule.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    works: obras,
    branchLocation: branchCoords,
    summary: {
      totalTrips: schedule.length,
      completionTime: new Date(finalEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      efficiency: 0.98
    }
  };
};
