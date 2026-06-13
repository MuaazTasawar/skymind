"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";
import FleetPanel from "@/components/fleet/FleetPanel";
import TelemetryBar from "@/components/telemetry/TelemetryBar";
import MissionControl from "@/components/mission/MissionControl";
import type { Drone, Mission, ZoneAssignment } from "@/types";

// Load map dynamically — MapLibre requires browser APIs
const MissionMap = dynamic(() => import("@/components/map/MissionMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading map...</div>
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [assignments, setAssignments]     = useState<ZoneAssignment[]>([]);

  function handleMissionCreated(mission: Mission) {
    // When a mission is created, the assignments come back in Phase 11
    // For now just log it
    console.log("[dashboard] mission created:", mission.id);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* Top header */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar nav */}
        <Sidebar />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel — Fleet */}
          <div className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden flex-shrink-0">
            <FleetPanel onDroneSelect={setSelectedDrone} />
          </div>

          {/* Centre — Map */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Telemetry bar */}
            <div className="h-20 border-b border-gray-800 flex-shrink-0">
              <TelemetryBar drone={selectedDrone} />
            </div>

            {/* Map */}
            <div className="flex-1 p-3">
              <MissionMap
                assignments={assignments}
                className="h-full"
              />
            </div>
          </div>

          {/* Right panel — Mission Control */}
          <div className="w-64 bg-gray-950 border-l border-gray-800 overflow-y-auto flex-shrink-0">
            <MissionControl onMissionCreated={handleMissionCreated} />
          </div>

        </div>
      </div>
    </div>
  );
}