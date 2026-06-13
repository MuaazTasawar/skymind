"use client";

import Header from "@/components/ui/Header";
import Sidebar from "@/components/ui/Sidebar";
import MissionHistory from "@/components/mission/MissionHistory";

export default function MissionsPage() {
  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <MissionHistory />
        </main>
      </div>
    </div>
  );
}