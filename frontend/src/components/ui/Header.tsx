"use client";

import { useRouter } from "next/navigation";
import { clearAuth, getOperator } from "@/lib/auth";
import { useFleetStore } from "@/store/fleetStore";

export default function Header() {
  const router   = useRouter();
  const operator = typeof window !== "undefined" ? getOperator() : null;
  const wsConnected = useFleetStore(s => s.wsConnected);
  const drones   = useFleetStore(s => s.drones);
  const flyingCount = Object.values(drones).filter(d => d.status === "flying").length;

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 gap-4 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <span className="font-bold text-white text-sm tracking-wide">SkyMind</span>
        <span className="text-gray-600 text-xs">GCS</span>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 ml-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
          ${wsConnected ? "bg-green-950 text-green-400 border border-green-900" : "bg-red-950 text-red-400 border border-red-900"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
          {wsConnected ? "Live" : "Offline"}
        </div>

        {flyingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                          bg-blue-950 text-blue-400 border border-blue-900">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {flyingCount} airborne
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Operator info + logout */}
      {operator && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-medium text-white">{operator.username}</div>
            <div className="text-xs text-gray-500 capitalize">{operator.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded
                       hover:bg-gray-800 transition"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}