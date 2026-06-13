"use client";

import type { Drone, DroneStatus } from "@/types";

interface DroneCardProps {
  drone: Drone;
  selected?: boolean;
  onClick?: () => void;
}

const STATUS_COLOR: Record<DroneStatus, string> = {
  idle:    "bg-gray-500",
  armed:   "bg-amber-500",
  flying:  "bg-blue-500",
  fault:   "bg-red-500",
  rtl:     "bg-purple-500",
  landing: "bg-orange-500",
};

const STATUS_TEXT: Record<DroneStatus, string> = {
  idle:    "Idle",
  armed:   "Armed",
  flying:  "Flying",
  fault:   "FAULT",
  rtl:     "RTL",
  landing: "Landing",
};

function BatteryBar({ pct }: { pct: number }) {
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DroneCard({ drone, selected, onClick }: DroneCardProps) {
  const dotColor = STATUS_COLOR[drone.status] ?? "bg-gray-500";
  const isFault  = drone.status === "fault";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all
        ${selected
          ? "border-blue-500 bg-blue-950/40"
          : "border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-800/60"
        }
        ${isFault ? "border-red-800 animate-pulse" : ""}
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} ${isFault ? "animate-ping" : ""}`} />
          <span className="font-semibold text-white text-sm">{drone.name}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full
          ${isFault ? "bg-red-900/60 text-red-400" : "bg-gray-800 text-gray-300"}`}>
          {STATUS_TEXT[drone.status] ?? drone.status}
        </span>
      </div>

      {/* Battery */}
      <BatteryBar pct={drone.battery_pct ?? 0} />

      {/* Telemetry row */}
      <div className="grid grid-cols-3 gap-1 mt-2">
        <div className="text-center">
          <div className="text-xs text-gray-500">Alt</div>
          <div className="text-xs font-mono text-gray-300">{(drone.alt_m ?? 0).toFixed(1)}m</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Spd</div>
          <div className="text-xs font-mono text-gray-300">{(drone.groundspeed_ms ?? 0).toFixed(1)}m/s</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Hdg</div>
          <div className="text-xs font-mono text-gray-300">{(drone.heading_deg ?? 0).toFixed(0)}°</div>
        </div>
      </div>

      {/* GPS / Armed indicators */}
      <div className="flex gap-2 mt-2">
        <span className={`text-xs px-1.5 py-0.5 rounded ${drone.armed ? "bg-amber-900/50 text-amber-400" : "bg-gray-800 text-gray-600"}`}>
          {drone.armed ? "ARMED" : "DISARMED"}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${drone.gps_fix ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
          {drone.gps_fix ? "GPS" : "NO GPS"}
        </span>
        {drone.connected === false && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">DISC</span>
        )}
      </div>
    </button>
  );
}