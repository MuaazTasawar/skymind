"use client";

import { useState } from "react";
import { useFleetStore } from "@/store/fleetStore";
import DroneCard from "./DroneCard";
import type { Drone } from "@/types";

interface FleetPanelProps {
  onDroneSelect?: (drone: Drone) => void;
}

export default function FleetPanel({ onDroneSelect }: FleetPanelProps) {
  const { drones, faultEvents, wsConnected } = useFleetStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const droneList = Object.values(drones);
  const flyingCount = droneList.filter(d => d.status === "flying").length;
  const faultCount  = droneList.filter(d => d.status === "fault").length;

  function handleSelect(drone: Drone) {
    setSelectedId(drone.id);
    onDroneSelect?.(drone);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Fleet</h2>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-400" : "bg-red-500"}`} />
          <span className="text-xs text-gray-500">{droneList.length} drones</span>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-800">
        <div className="flex-1 text-center bg-blue-950/40 rounded-lg py-1.5">
          <div className="text-lg font-bold text-blue-400">{flyingCount}</div>
          <div className="text-xs text-gray-500">Flying</div>
        </div>
        <div className="flex-1 text-center bg-gray-800/40 rounded-lg py-1.5">
          <div className="text-lg font-bold text-gray-300">{droneList.length - flyingCount - faultCount}</div>
          <div className="text-xs text-gray-500">Idle</div>
        </div>
        <div className={`flex-1 text-center rounded-lg py-1.5 ${faultCount > 0 ? "bg-red-950/40" : "bg-gray-800/40"}`}>
          <div className={`text-lg font-bold ${faultCount > 0 ? "text-red-400" : "text-gray-600"}`}>{faultCount}</div>
          <div className="text-xs text-gray-500">Fault</div>
        </div>
      </div>

      {/* Drone list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {droneList.length === 0 ? (
          <div className="text-center text-gray-600 text-sm pt-8">
            <div className="text-2xl mb-2">📡</div>
            No drones connected
          </div>
        ) : (
          droneList.map(drone => (
            <DroneCard
              key={drone.id}
              drone={drone}
              selected={drone.id === selectedId}
              onClick={() => handleSelect(drone)}
            />
          ))
        )}
      </div>

      {/* Recent fault events */}
      {faultEvents.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <div className="text-xs font-semibold text-red-400 mb-2">⚠ Recent Faults</div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {faultEvents.slice(0, 3).map((ev, i) => (
              <div key={i} className="text-xs text-gray-400 bg-red-950/20 rounded px-2 py-1">
                <span className="text-red-400 font-medium">{ev.drone_name}</span>
                {" — "}{ev.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}