import type { Drone, DroneStatus } from "@/types";

interface DroneMarkerProps {
  drone: Drone;
  onClick?: (drone: Drone) => void;
}

const STATUS_COLORS: Record<DroneStatus, string> = {
  idle:    "#6b7280",
  armed:   "#f59e0b",
  flying:  "#3b82f6",
  fault:   "#ef4444",
  rtl:     "#8b5cf6",
  landing: "#f97316",
};

const STATUS_PULSE: Record<DroneStatus, boolean> = {
  idle:    false,
  armed:   true,
  flying:  false,
  fault:   true,
  rtl:     true,
  landing: true,
};

/**
 * Returns an SVG string for a drone marker at the given status/heading.
 * Used by MapLibre as a custom HTML marker.
 */
export function createDroneMarkerElement(drone: Drone): HTMLDivElement {
  const color = STATUS_COLORS[drone.status] ?? "#6b7280";
  const pulse = STATUS_PULSE[drone.status] ?? false;

  const wrapper = document.createElement("div");
  wrapper.style.cursor = "pointer";
  wrapper.style.userSelect = "none";

  wrapper.innerHTML = `
    <div style="position:relative; width:32px; height:32px;">
      ${pulse ? `
        <div style="
          position:absolute; inset:-4px;
          border-radius:50%;
          background:${color};
          opacity:0.25;
          animation: ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
        "></div>` : ""}
      <svg
        width="32" height="32" viewBox="0 0 32 32"
        style="transform: rotate(${drone.heading_deg ?? 0}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Drone body -->
        <circle cx="16" cy="16" r="7" fill="${color}" />
        <!-- Heading indicator (nose) -->
        <polygon points="16,4 13,14 19,14" fill="${color}" opacity="0.9"/>
        <!-- Arm indicators -->
        <circle cx="6"  cy="6"  r="3" fill="${color}" opacity="0.7"/>
        <circle cx="26" cy="6"  r="3" fill="${color}" opacity="0.7"/>
        <circle cx="6"  cy="26" r="3" fill="${color}" opacity="0.7"/>
        <circle cx="26" cy="26" r="3" fill="${color}" opacity="0.7"/>
        <line x1="6"  y1="6"  x2="16" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="26" y1="6"  x2="16" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="6"  y1="26" x2="16" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <line x1="26" y1="26" x2="16" y2="16" stroke="${color}" stroke-width="1.5" opacity="0.5"/>
        <!-- Battery indicator -->
        <rect x="12" y="13" width="${Math.max(1, 8 * (drone.battery_pct / 100))}" height="6"
              rx="1" fill="white" opacity="0.9"/>
      </svg>
      <!-- Name label -->
      <div style="
        position:absolute; top:34px; left:50%; transform:translateX(-50%);
        background:rgba(0,0,0,0.75); color:white;
        font-size:10px; font-weight:600; white-space:nowrap;
        padding:1px 4px; border-radius:3px;
        border: 1px solid ${color};
      ">${drone.name}</div>
    </div>
    <style>
      @keyframes ping {
        75%, 100% { transform: scale(2); opacity: 0; }
      }
    </style>
  `;

  return wrapper;
}

/**
 * React component version — used in non-map contexts (fleet panel etc.)
 */
export default function DroneMarkerBadge({ drone, onClick }: DroneMarkerProps) {
  const color = STATUS_COLORS[drone.status] ?? "#6b7280";
  return (
    <button
      onClick={() => onClick?.(drone)}
      className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-semibold text-white">{drone.name}</span>
      <span className="text-xs text-gray-400 capitalize">{drone.status}</span>
      <span className="text-xs text-gray-500 ml-auto">{drone.battery_pct}%</span>
    </button>
  );
}