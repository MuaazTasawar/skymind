"use client";

import { useState } from "react";
import { useMissionStore } from "@/store/missionStore";
import { createMission, updateMissionStatus } from "@/lib/api";
import type { Mission } from "@/types";

interface MissionControlProps {
  onMissionCreated?: (mission: Mission) => void;
}

export default function MissionControl({ onMissionCreated }: MissionControlProps) {
  const {
    drawingZone, isDrawing,
    startDrawing, completeDrawing, cancelDrawing,
    upsertMission, activeMissionId, missions,
  } = useMissionStore();

  const [missionName, setMissionName] = useState("");
  const [altitudeM, setAltitudeM]     = useState(10);
  const [airspeedMs, setAirspeedMs]   = useState(5);
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState("");

  const activeMission = missions.find(m => m.id === activeMissionId) ?? null;
  const canCreate = drawingZone?.isComplete && (drawingZone.points.length >= 3) && missionName.trim();

  async function handleCreateMission() {
    if (!canCreate || !drawingZone) return;
    setCreating(true);
    setError("");

    try {
      const mission = await createMission({
        name: missionName.trim(),
        zone_geojson: drawingZone.points,
        altitude_m:  altitudeM,
        airspeed_ms: airspeedMs,
      });
      upsertMission(mission);
      onMissionCreated?.(mission);
      setMissionName("");
      cancelDrawing();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create mission");
    } finally {
      setCreating(false);
    }
  }

  async function handleAbort() {
    if (!activeMission) return;
    try {
      await updateMissionStatus(activeMission.id, "aborted");
      useMissionStore.getState().updateMissionStatus(activeMission.id, "aborted");
    } catch (e) {
      console.error("abort failed:", e);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-white">Mission Control</h3>

      {/* Zone drawing controls */}
      {!isDrawing && !drawingZone?.isComplete && (
        <button
          onClick={startDrawing}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
        >
          ✏ Draw Mission Zone
        </button>
      )}

      {isDrawing && (
        <div className="space-y-2">
          <div className="text-xs text-blue-400 bg-blue-950/40 rounded-lg px-3 py-2">
            Click on map to add points ({drawingZone?.points.length ?? 0} added)
          </div>
          <div className="flex gap-2">
            <button
              onClick={completeDrawing}
              disabled={(drawingZone?.points.length ?? 0) < 3}
              className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700
                         disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition"
            >
              ✓ Complete Zone
            </button>
            <button
              onClick={cancelDrawing}
              className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold rounded-lg transition"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mission form — shown after zone is drawn */}
      {drawingZone?.isComplete && (
        <div className="space-y-2 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-green-400 mb-2">
            ✓ Zone drawn ({drawingZone.points.length} points)
          </div>

          <input
            type="text"
            placeholder="Mission name"
            value={missionName}
            onChange={e => setMissionName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2
                       text-sm text-white placeholder-gray-500 focus:outline-none
                       focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Alt (m)</label>
              <input
                type="number"
                value={altitudeM}
                onChange={e => setAltitudeM(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5
                           text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Speed (m/s)</label>
              <input
                type="number"
                value={airspeedMs}
                onChange={e => setAirspeedMs(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5
                           text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCreateMission}
              disabled={!canCreate || creating}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700
                         disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
            >
              {creating ? "Planning..." : "🚀 Launch Mission"}
            </button>
            <button
              onClick={cancelDrawing}
              className="py-2 px-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active mission status */}
      {activeMission && (
        <div className="border border-gray-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white truncate">{activeMission.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full capitalize
              ${activeMission.status === "active"    ? "bg-blue-900/60 text-blue-400"   : ""}
              ${activeMission.status === "completed" ? "bg-green-900/60 text-green-400" : ""}
              ${activeMission.status === "fault"     ? "bg-red-900/60 text-red-400"     : ""}
              ${activeMission.status === "pending"   ? "bg-gray-800 text-gray-400"      : ""}
              ${activeMission.status === "aborted"   ? "bg-orange-900/60 text-orange-400" : ""}
            `}>
              {activeMission.status}
            </span>
          </div>

          {activeMission.status === "active" && (
            <button
              onClick={handleAbort}
              className="w-full py-1.5 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition"
            >
              ⛔ ABORT MISSION
            </button>
          )}
        </div>
      )}
    </div>
  );
}