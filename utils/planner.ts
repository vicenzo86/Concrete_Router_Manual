import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

export interface RoutedWork extends WorkSite {
  outward: number;
  inward: number;
}
export function validateParams(p: SimulationParams) {
  for (const key of ['totalTrucks', 'totalPumps', 'truckCapacity', 'loadTime', 'unloadTime'] as const) {
    if (!Number.isFinite(p[key]) || p[key] <= 0) throw new Error(`${key}: informe um valor positivo.`);
  }
  if (!Number.isInteger(p.totalTrucks) || !Number.isInteger(p.totalPumps)) throw new Error('Frota e bombas devem ser inteiros.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.startDate) || !/^\d{2}:\d{2}$/.test(p.startTime)) throw new Error('Informe data e horário válidos.');
  if (!p.uploadedData?.length) throw new Error('Importe uma planilha com obras.');
  p.uploadedData.forEach((w, i) => {
    if (!Number.isInteger(w.loads) || w.loads <= 0) throw new Error(`Obra ${i + 1}: cargas devem ser inteiras e positivas.`);
  });
}

/** Agenda explícita de recursos. Horários travados representam a primeira descarga. */
export function planSchedule(p: SimulationParams, input: RoutedWork[], branch: {lat: number; lng: number}, warnings: string[] = []): OptimizationResult {
  validateParams(p);
  const diagnostics = [...warnings];
  const errors: string[] = [];
  const base = new Date(`${p.startDate}T${p.startTime}:00`).getTime();
  if (!Number.isFinite(base)) throw new Error('Data de operação inválida.');
  const trucks = Array.from({length: p.totalTrucks}, (_, i) => ({id: `C-${i + 1}`, free: 0}));
  const pumps = Array.from({length: p.totalPumps}, (_, i) => ({id: `BOMBA-${i + 1}`, free: 0}));
  const schedule: ScheduleItem[] = [];
  const works = input.map(w => ({...w}));
  const relative = (time: string) => {
    const target = new Date(`${p.startDate}T${time}:00`).getTime();
    if (!Number.isFinite(target)) throw new Error('Horário manual inválido.');
    return (target - base) / 60000;
  };
  const ordered = works.map((work, index) => ({work, index, constraint: p.manualConstraints.find(c => c.workIndex === index)}))
    .sort((a, b) => {
      const ac = a.constraint?.locked, bc = b.constraint?.locked;
      if (ac && bc) return relative(a.constraint!.forcedStartTime) - relative(b.constraint!.forcedStartTime);
      if (ac !== bc) return ac ? -1 : 1;
      return a.index - b.index;
    });
  const add = (work: RoutedWork, truckId: string, pumpId: string, load: number, status: ScheduleItem['status'], from: number, to: number) => {
    schedule.push({id: `${work.id}-${load}-${status}`, workId: work.id, truckId, pumpId, loadNumber: load, status,
      startTime: new Date(base + from * 60000), endTime: new Date(base + to * 60000)});
  };
  for (const {work: w, constraint: c} of ordered) {
    const fixed = !!c?.locked;
    if (fixed && (!Number.isInteger(c!.forcedTrucks) || c!.forcedTrucks < 1 || c!.forcedTrucks > p.totalTrucks)) throw new Error(`${w.name}: frota manual inválida.`);
    if (fixed && (!Number.isInteger(c!.forcedPumpId) || c!.forcedPumpId < 1 || c!.forcedPumpId > p.totalPumps)) throw new Error(`${w.name}: bomba manual inválida.`);
    const pump = fixed ? pumps[c!.forcedPumpId - 1] : [...pumps].sort((a,b) => a.free - b.free)[0];
    const count = fixed ? c!.forcedTrucks : Math.min(p.totalTrucks, w.loads, Math.max(1, Math.ceil((p.loadTime + w.outward + p.unloadTime + w.inward) / p.unloadTime)));
    const selected = [...trucks].sort((a,b) => a.free - b.free).slice(0, count);
    const cycle = p.loadTime + w.outward + p.unloadTime + w.inward;
    let firstArrival = fixed ? relative(c!.forcedStartTime) : Math.max(pump.free, selected[0].free + p.loadTime + w.outward);
    if (fixed && firstArrival < pump.free) errors.push(`${w.name}: ${pump.id} ainda ocupada no início solicitado.`);
    let nextDischarge = firstArrival;
    w.pumpId = pump.id;
    w.trucksAssigned = count;
    for (let load = 0; load < w.loads; load++) {
      const truck = selected[load % count];
      let discharge = Math.max(nextDischarge, firstArrival + Math.floor(load / count) * cycle + (load % count) * p.unloadTime);
      if (!fixed) discharge = Math.max(discharge, truck.free + p.loadTime + w.outward);
      const loading = discharge - w.outward - p.loadTime;
      if (loading < 0) errors.push(`${w.name}, carga ${load + 1}: carregamento anterior ao início da operação.`);
      if (loading < truck.free - 0.0001) errors.push(`${w.name}, carga ${load + 1}: ${truck.id} indisponível para carregar no horário previsto.`);
      add(w, truck.id, pump.id, load + 1, 'loading', loading, loading + p.loadTime);
      add(w, truck.id, pump.id, load + 1, 'traveling', loading + p.loadTime, discharge);
      add(w, truck.id, pump.id, load + 1, 'unloading', discharge, discharge + p.unloadTime);
      add(w, truck.id, pump.id, load + 1, 'returning', discharge + p.unloadTime, discharge + p.unloadTime + w.inward);
      truck.free = Math.max(truck.free, discharge + p.unloadTime + w.inward);
      nextDischarge = discharge + p.unloadTime;
    }
    pump.free = Math.max(pump.free, nextDischarge);
  }
  diagnostics.push('Deslocamento, montagem e desmontagem das bombas e capacidade simultânea de carregamento da usina não estão modelados. Confira esses recursos.');
  const deliveries = schedule.filter(s => s.status === 'unloading');
  const last = Math.max(base, ...deliveries.map(s => s.endTime.getTime()));
  const finish = new Date(last);
  return {works, schedule: schedule.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()), branchLocation: branch,
    diagnostics, conflicts: [...new Set(errors)], summary: {totalTrips: deliveries.length,
      completionTime: `${finish.toLocaleDateString('pt-BR')} ${finish.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`, efficiency: 0}};
}
