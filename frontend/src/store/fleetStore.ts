import { create } from "zustand";
import type { Drone, FaultEvent, ReassignEvent } from "@/types";

interface FleetState {
  drones: Record<string, Drone>;        // keyed by drone id
  lastUpdate: string | null;
  faultEvents: FaultEvent[];
  reassignEvents: ReassignEvent[];
  wsConnected: boolean;

  // Actions
  updateFleet: (drones: Drone[], timestamp: string) => void;
  addFaultEvent: (event: FaultEvent) => void;
  addReassignEvent: (event: ReassignEvent) => void;
  setWsConnected: (connected: boolean) => void;
  clearEvents: () => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  drones: {},
  lastUpdate: null,
  faultEvents: [],
  reassignEvents: [],
  wsConnected: false,

  updateFleet: (drones, timestamp) =>
    set(() => ({
      drones: Object.fromEntries(drones.map(d => [d.id, d])),
      lastUpdate: timestamp,
    })),

  addFaultEvent: (event) =>
    set(state => ({
      faultEvents: [event, ...state.faultEvents].slice(0, 50),
    })),

  addReassignEvent: (event) =>
    set(state => ({
      reassignEvents: [event, ...state.reassignEvents].slice(0, 50),
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  clearEvents: () => set({ faultEvents: [], reassignEvents: [] }),
}));