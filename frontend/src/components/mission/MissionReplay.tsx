"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ZoneAssignment, Mission } from "@/types";

interface ReplayFrame {
  timestamp: string;
  drone_id: string;
  drone_name: string;
  lat: number;
  lng: number;
  alt_m: number;
  battery_pct: number;
  status: string;
  waypoint_index: number;
}

interface MissionReplayProps {
  mission: Mission;
  assignments: ZoneAssignment[];
}

export default function MissionReplay({ mission, assignments }: MissionReplayProps) {
  const [frames, setFrames]         = useState<ReplayFrame[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [speed, setSpeed]           = useState(1);
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate synthetic replay frames from assignments
  // In production these would come from the telemetry_logs table
  useEffect(() => {
    if (!assignments.length) return;

    const synthetic: ReplayFrame[] = [];
    const droneNames: Record<string, string> = {
      "drone-1": "Alpha",
      "drone-2": "Bravo",
      "drone-3": "Charlie",
      "drone-4": "Delta",
      "drone-5": "Echo",
    };

    assignments.forEach(asn => {
      asn.waypoints?.forEach((wp, i) => {
        synthetic.push({
          timestamp: new Date(
            new Date(mission.created_at).getTime() + i * 5000
          ).toISOString(),
          drone_id:      asn.drone_id,
          drone_name:    droneNames[asn.drone_id] ?? asn.drone_id,
          lat:           wp.lat,
          lng:           wp.lng,
          alt_m:         wp.alt,
          battery_pct:   Math.max(20, 100 - i * 2),
          status:        "flying",
          waypoint_index: i,
        });
      });
    });

    synthetic.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    setFrames(synthetic);
    setCurrentIdx(0);
  }, [assignments, mission]);

  const tick = useCallback(() => {
    setCurrentIdx(prev => {
      if (prev >= frames.length - 1) {
        setPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [frames.length]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(tick, 500 / speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, tick]);

  const currentFrame = frames[currentIdx];
  const progress = frames.length > 0 ? (currentIdx / (frames.length - 1)) * 100 : 0;

  if (!assignments.length) {
    return (
      <div className="text-center text-gray-500 text-sm py-8">
        No assignments available for replay
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Mission Replay</h3>

      {/* Current frame info */}
      {currentFrame && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Drone</div>
            <div className="text-sm font-semibold text-white">{currentFrame.drone_name}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Waypoint</div>
            <div className="text-sm font-semibold text-white">{currentFrame.waypoint_index + 1}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Altitude</div>
            <div className="text-sm font-mono text-white">{currentFrame.alt_m.toFixed(1)}m</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-xs text-gray-500">Battery</div>
            <div className={`text-sm font-mono ${currentFrame.battery_pct < 30 ? "text-red-400" : "text-white"}`}>
              {currentFrame.battery_pct}%
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={currentIdx}
          onChange={e => {
            setCurrentIdx(Number(e.target.value));
            setPlaying(false);
          }}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Frame {currentIdx + 1}</span>
          <span>{Math.round(progress)}%</span>
          <span>{frames.length} frames</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setCurrentIdx(0); setPlaying(false); }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition"
          title="Reset"
        >
          ⏮
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white
                     font-semibold text-sm transition"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          onClick={() => { setCurrentIdx(frames.length - 1); setPlaying(false); }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition"
          title="End"
        >
          ⏭
        </button>

        {/* Speed selector */}
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 text-white text-xs
                     rounded-lg px-2 py-2 focus:outline-none"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>
    </div>
  );
}