
export interface WorkSite {
  id: string;
  name: string;
  address: string;
  loads: number;
  volume: number; // m3
  lat: number;
  lng: number;
  trucksAssigned?: number; 
  pumpId?: string;
}

export interface UploadedWork {
  loads: number;
  address: string;
  lat?: number;
  lng?: number;
}

export interface WorkConstraint {
  workIndex: number; 
  forcedTrucks: number;
  forcedPumpId: number; 
  forcedStartTime: string; 
  locked: boolean; 
}

export interface SimulationParams {
  mode: 'optimizer' | 'simulator'; 
  apiKey: string;
  branchAddress: string;
  branchLat: string;
  branchLng: string;
  loadTime: number; 
  unloadTime: number; 
  totalTrucks: number;
  truckCapacity: number; 
  totalPumps: number;
  startDate: string; 
  startTime: string; 
  generations: number;
  popSize: number;
  uploadedData?: UploadedWork[];
  manualConstraints: WorkConstraint[]; 
}

export interface ScheduleItem {
  id: string;
  workId: string;
  truckId: string;
  pumpId: string;
  loadNumber: number;
  startTime: Date;
  endTime: Date;
  status: 'loading' | 'traveling' | 'unloading' | 'returning';
}

export interface OptimizationResult {
  schedule: ScheduleItem[];
  works: WorkSite[];
  branchLocation?: { lat: number; lng: number };
  summary: {
    totalTrips: number;
    completionTime: string;
    efficiency: number;
  };
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  mode: 'optimizer' | 'simulator';
  params: SimulationParams;
  result: OptimizationResult;
}
