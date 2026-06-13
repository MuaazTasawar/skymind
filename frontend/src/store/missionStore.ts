import { create } from "zustand";
import type { Mission, MissionStatus } from "@/types";

interface DrawingZone {
  points: [number, number][];   // [lng, lat] pairs (GeoJSON order)
  isComplete: boolean;
}

interface MissionState {
  missions: Mission[];
  activeMissionId: string | null;
  drawingZone: DrawingZone | null;
  isDrawing: boolean;

  // Actions
  setMissions: (missions: Mission[]) => void;
  upsertMission: (mission: Mission) => void;
  updateMissionStatus: (id: string, status: MissionStatus) => void;
  setActiveMission: (id: string | null) => void;

  // Zone drawing
  startDrawing: () => void;
  addDrawPoint: (point: [number, number]) => void;
  completeDrawing: () => void;
  cancelDrawing: () => void;
}

export const useMissionStore = create<MissionState>((set) => ({
  missions: [],
  activeMissionId: null,
  drawingZone: null,
  isDrawing: false,

  setMissions: (missions) => set({ missions }),

  upsertMission: (mission) =>
    set(state => ({
      missions: state.missions.find(m => m.id === mission.id)
        ? state.missions.map(m => m.id === mission.id ? mission : m)
        : [mission, ...state.missions],
    })),

  updateMissionStatus: (id, status) =>
    set(state => ({
      missions: state.missions.map(m =>
        m.id === id ? { ...m, status } : m
      ),
    })),

  setActiveMission: (id) => set({ activeMissionId: id }),

  startDrawing: () =>
    set({ isDrawing: true, drawingZone: { points: [], isComplete: false } }),

  addDrawPoint: (point) =>
    set(state => ({
      drawingZone: state.drawingZone
        ? { ...state.drawingZone, points: [...state.drawingZone.points, point] }
        : { points: [point], isComplete: false },
    })),

  completeDrawing: () =>
    set(state => ({
      isDrawing: false,
      drawingZone: state.drawingZone
        ? { ...state.drawingZone, isComplete: true }
        : null,
    })),

  cancelDrawing: () =>
    set({ isDrawing: false, drawingZone: null }),
}));