import { SimulationParams } from '../types';
import { planSchedule, validateParams, RoutedWork } from './planner';

async function request(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw new Error(`Serviço de mapas: HTTP ${response.status}.`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function locate(address: string, key: string) {
  if (!key || !address.trim()) throw new Error('Informe a chave HERE e um endereço válido ou coordenadas.');
  const data = await request(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${encodeURIComponent(key)}&limit=1`);
  if (!data.items?.length) throw new Error(`Endereço não localizado: ${address}.`);
  return data.items[0].position as {lat:number; lng:number};
}
function coordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Coordenadas inválidas.');
  return {lat, lng};
}
async function duration(from: {lat:number;lng:number}, to: {lat:number;lng:number}, key: string, departure: string) {
  const data = await request(`https://router.hereapi.com/v8/routes?transportMode=truck&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&return=summary&departureTime=${encodeURIComponent(departure)}&apiKey=${encodeURIComponent(key)}`);
  const sections = data.routes?.[0]?.sections;
  if (!sections?.length) throw new Error('Não foi possível calcular uma rota. Confira a chave HERE e os endereços.');
  const seconds = sections.reduce((sum: number, s: any) => sum + s.summary.duration, 0);
  if (!Number.isFinite(seconds)) throw new Error('Tempo de viagem inválido.');
  return seconds / 60;
}
export async function generateMockData(p: SimulationParams) {
  validateParams(p);
  if (!p.apiKey.trim()) throw new Error('Informe sua chave HERE para calcular deslocamentos reais.');
  const branch = p.branchLat.trim() && p.branchLng.trim()
    ? coordinates(Number(p.branchLat), Number(p.branchLng)) : await locate(p.branchAddress, p.apiKey);
  const departure = new Date(`${p.startDate}T${p.startTime}:00`).toISOString();
  const works: RoutedWork[] = [];
  for (const [i, item] of p.uploadedData!.entries()) {
    const location = item.lat !== undefined && item.lng !== undefined
      ? coordinates(item.lat, item.lng) : await locate(item.address, p.apiKey);
    const outward = await duration(branch, location, p.apiKey, departure);
    const inward = await duration(location, branch, p.apiKey, departure);
    works.push({id:`W-${i + 1}`, name:item.address || `Obra ${i + 1}`, address:item.address,
      loads:item.loads, volume:item.loads * p.truckCapacity, ...location, outward, inward});
  }
  return planSchedule(p, works, branch, ['Tempos de viagem calculados para o início da operação e mantidos constantes durante o plano; confira variações de trânsito e restrições específicas dos veículos.']);
}
