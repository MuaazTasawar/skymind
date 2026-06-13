"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";
import MissionReplay from "@/components/mission/MissionReplay";
import { fetchMission, updateMissionStatus } from "@/lib/api";
import type { MissionDetail, ZoneAssignment } from "@/types";

const MissionMap = dynamic(() => import("@/components/map/MissionMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="text-gray-500 text-sm">Loading map...</div>
    </div>
  ),
});

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-gray-800 text-gray-400",
  planning:  "bg-yellow-900/50 text-yellow-400",
  active:    "bg-blue-900/50 text-blue-400",
  completed: "bg-green-900/50 text-green-400",
  aborted:   "bg-orange-900/50 text-orange-400",
  fault:     "bg-red-900/50 text-red-400",
};

export default function MissionDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params.id as string;

  const [mission, setMission]         = useState<MissionDetail | null>(null);
  const [assignments, setAssignments] = useState<ZoneAssignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [aborting, setAborting]       = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMission(id)
      .then(m => {
        setMission(m);
        setAssignments(m.assignments ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAbort() {
    if (!mission) return;
    setAborting(true);
    try {
      await updateMissionStatus(mission.id, "aborted");
      setMission(prev => prev ? { ...prev, status: "aborted" } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Abort failed");
    } finally {
      setAborting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <Header />
        <div className="flex flex-1 items-center justify-center text-gray-500">
          Loading mission...
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="text-red-400 mb-4">{error || "Mission not found"}</div>
            <button
              onClick={() => router.push("/dashboard/missions")}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ← Back to missions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 overflow-hidden">

          {/* Left — Mission details */}
          <div className="w-72 border-r border-gray-800 overflow-y-auto flex-shrink-0 p-4 space-y-4">

            {/* Back button */}
            <button
              onClick={() => router.push("/dashboard/missions")}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition"
            >
              ← Missions
            </button>

            {/* Mission header */}
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h1 className="text-base font-bold text-white leading-tight">{mission.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0
                  ${STATUS_STYLES[mission.status] ?? "bg-gray-800 text-gray-400"}`}>
                  {mission.status}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(mission.created_at).toLocaleString()}
              </div>
            </div>

            {/* Mission stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Altitude</div>
                <div className="text-sm font-mono text-white">{mission.altitude_m}m</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Airspeed</div>
                <div className="text-sm font-mono text-white">{mission.airspeed_ms}m/s</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Drones</div>
                <div className="text-sm font-mono text-white">{assignments.length}</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">Zone pts</div>
                <div className="text-sm font-mono text-white">{mission.zone_geojson?.length ?? 0}</div>
              </div>
            </div>

            {/* Assignments */}
            {assignments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                  Drone Assignments
                </h3>
                <div className="space-y-1.5">
                  {assignments.map(asn => (
                    <div key={asn.id}
                         className="flex items-center justify-between bg-gray-900
                                    rounded-lg px-3 py-2 border border-gray-800">
                      <div>
                        <div className="text-xs font-semibold text-white">{asn.zone_id}</div>
                        <div className="text-xs text-gray-500">{asn.drone_id}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full
                        ${asn.status === "complete"    ? "bg-green-900/50 text-green-400" : ""}
                        ${asn.status === "flying"      ? "bg-blue-900/50 text-blue-400"   : ""}
                        ${asn.status === "assigned"    ? "bg-gray-800 text-gray-400"       : ""}
                        ${asn.status === "reassigned"  ? "bg-purple-900/50 text-purple-400" : ""}
                      `}>
                        {asn.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abort button */}
            {mission.status === "active" && (
              <button
                onClick={handleAbort}
                disabled={aborting}
                className="w-full py-2 bg-red-800 hover:bg-red-700 disabled:bg-gray-700
                           text-white text-sm font-bold rounded-lg transition"
              >
                {aborting ? "Aborting..." : "⛔ ABORT MISSION"}
              </button>
            )}

            {/* Replay */}
            <MissionReplay mission={mission} assignments={assignments} />
          </div>

          {/* Right — Map with path overlay */}
          <div className="flex-1 p-3">
            <MissionMap
              assignments={assignments}
              className="h-full"
            />
          </div>

        </div>
      </div>
    </div>
  );
}