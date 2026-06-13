"use client";

import { useFleetStore } from "@/store/fleetStore";
import AttitudeIndicator from "./AttitudeIndicator";
import type { Drone } from "@/types";

interface TelemetryBarProps {
  drone?: Drone | null;
}

function TelemetryCell({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 bg-gray-900 rounded-lg border border-gray-800">
      <span className="text-xs text-gray-500 mb-0.5">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-mono font-semibold text-white">{value}</span>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
    </div>
  );
}

export default function TelemetryBar({ drone }: TelemetryBarProps) {
  const drones = useFleetStore(s => s.drones);
  const lastUpdate = useFleetStore(s => s.lastUpdate);

  // Use first flying drone if none selected
  const activeDrone = drone
    ?? Object.values(drones).find(d => d.status === "flying")
    ?? Object.values(drones)[0]
    ?? null;

  if (!activeDrone) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No drone selected
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 h-full overflow-x-auto">
      {/* Attitude indicator */}
      <div className="flex-shrink-0">
        <AttitudeIndicator
          roll={activeDrone.roll_deg ?? 0}
          pitch={activeDrone.pitch_deg ?? 0}
          size={72}
        />
      </div>

      {/* Drone name + status */}
      <div className="flex-shrink-0 border-r border-gray-800 pr-3">
        <div className="font-semibold text-white text-sm">{activeDrone.name}</div>
        <div className="text-xs text-gray-500 capitalize">{activeDrone.status}</div>
      </div>

      {/* Telemetry cells */}
      <div className="flex gap-2 flex-shrink-0">
        <TelemetryCell label="ALT"  value={(activeDrone.alt_m ?? 0).toFixed(1)}     unit="m"   />
        <TelemetryCell label="GND"  value={(activeDrone.groundspeed_ms ?? 0).toFixed(1)} unit="m/s" />
        <TelemetryCell label="AIR"  value={(activeDrone.airspeed_ms ?? 0).toFixed(1)}    unit="m/s" />
        <TelemetryCell label="HDG"  value={(activeDrone.heading_deg ?? 0).toFixed(0)}    unit="°"   />
        <TelemetryCell label="CLMB" value={(activeDrone.climb_rate_ms ?? 0).toFixed(1)}  unit="m/s" />
        <TelemetryCell label="BAT"  value={activeDrone.battery_pct ?? 0}            unit="%"   />
        <TelemetryCell label="VOLT" value={(activeDrone.battery_volt ?? 0).toFixed(2)}   unit="V"   />
      </div>

      {/* Waypoint progress */}
      {(activeDrone.waypoint_total ?? 0) > 0 && (
        <div className="flex-shrink-0 border-l border-gray-800 pl-3">
          <div className="text-xs text-gray-500 mb-0.5">Waypoint</div>
          <div className="text-sm font-mono text-white">
            {activeDrone.waypoint_index ?? 0} / {activeDrone.waypoint_total}
          </div>
          <div className="w-24 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{
                width: `${((activeDrone.waypoint_index ?? 0) / activeDrone.waypoint_total) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Last update */}
      {lastUpdate && (
        <div className="ml-auto flex-shrink-0 text-xs text-gray-600 border-l border-gray-800 pl-3">
          {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}