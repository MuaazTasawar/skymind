"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMissions } from "@/lib/api";
import type { Mission, MissionStatus } from "@/types";

const STATUS_STYLES: Record<MissionStatus, string> = {
  pending:   "bg-gray-800 text-gray-400",
  planning:  "bg-yellow-900/50 text-yellow-400",
  active:    "bg-blue-900/50 text-blue-400",
  completed: "bg-green-900/50 text-green-400",
  aborted:   "bg-orange-900/50 text-orange-400",
  fault:     "bg-red-900/50 text-red-400",
};

function MissionRow({ mission }: { mission: Mission }) {
  const createdAt = new Date(mission.created_at).toLocaleString();
  const duration  = mission.started_at && mission.completed_at
    ? Math.round(
        (new Date(mission.completed_at).getTime() -
         new Date(mission.started_at).getTime()) / 1000
      ) + "s"
    : mission.started_at ? "In progress" : "—";

  return (
    <Link
      href={`/dashboard/missions/${mission.id}`}
      className="flex items-center gap-4 px-4 py-3 border-b border-gray-800
                 hover:bg-gray-900/60 transition group"
    >
      {/* Status badge */}
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0
        ${STATUS_STYLES[mission.status] ?? "bg-gray-800 text-gray-400"}`}>
        {mission.status}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition">
          {mission.name}
        </div>
        <div className="text-xs text-gray-500">{createdAt}</div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 flex-shrink-0 text-right">
        <div>
          <div className="text-xs text-gray-500">Alt</div>
          <div className="text-xs font-mono text-gray-300">{mission.altitude_m}m</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Duration</div>
          <div className="text-xs font-mono text-gray-300">{duration}</div>
        </div>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition flex-shrink-0"
           fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

export default function MissionHistory() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [filter, setFilter]     = useState<MissionStatus | "all">("all");

  useEffect(() => {
    fetchMissions()
      .then(setMissions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all"
    ? missions
    : missions.filter(m => m.status === filter);

  const counts = missions.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white">Mission History</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {missions.length} total missions
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-3 border-b border-gray-800 overflow-x-auto">
        {(["all", "active", "completed", "aborted", "fault", "pending"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition
              ${filter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && counts[s] ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {/* Mission list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="text-center text-gray-500 text-sm py-12">
            Loading missions...
          </div>
        )}
        {error && (
          <div className="text-center text-red-400 text-sm py-12">
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🗂</div>
            <div className="text-gray-500 text-sm">No missions found</div>
          </div>
        )}
        {filtered.map(mission => (
          <MissionRow key={mission.id} mission={mission} />
        ))}
      </div>
    </div>
  );
}