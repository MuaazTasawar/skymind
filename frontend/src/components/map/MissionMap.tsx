"use client";

import { useEffect, useRef, useCallback } from "react";
import { useFleetStore } from "@/store/fleetStore";
import { useMissionStore } from "@/store/missionStore";
import { skyMindWS } from "@/lib/websocket";
import ZoneDrawer from "./ZoneDrawer";
import PathOverlay from "./PathOverlay";
import { createDroneMarkerElement } from "./DroneMarker";
import type { WSMessage, FleetSnapshot, FaultEvent, ReassignEvent, ZoneAssignment } from "@/types";

// MapLibre is loaded dynamically to avoid SSR issues
let maplibregl: typeof import("maplibre-gl") | null = null;

interface MissionMapProps {
  assignments?: ZoneAssignment[];
  className?: string;
}

export default function MissionMap({ assignments = [], className = "" }: MissionMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import("maplibre-gl").Map | null>(null);
  const markersRef   = useRef<Map<string, import("maplibre-gl").Marker>>(new Map());

  const { drones, updateFleet, addFaultEvent, addReassignEvent, setWsConnected } = useFleetStore();
  const { isDrawing } = useMissionStore();

  // Handle incoming WebSocket messages
  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "telemetry") {
      const snap = msg.payload as FleetSnapshot;
      updateFleet(snap.drones, snap.timestamp);
    } else if (msg.type === "drone_fault") {
      addFaultEvent(msg.payload as FaultEvent);
    } else if (msg.type === "zone_reassigned") {
      addReassignEvent(msg.payload as ReassignEvent);
    }
  }, [updateFleet, addFaultEvent, addReassignEvent]);

  // Initialise map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const initMap = async () => {
      maplibregl = await import("maplibre-gl");

      const map = new maplibregl.Map({
        container: mapContainer.current!,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
          }],
        },
        center: [73.0479, 33.6844], // Islamabad
        zoom: 13,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.ScaleControl(), "bottom-left");

      mapRef.current = map;
    };

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Connect WebSocket
  useEffect(() => {
    skyMindWS.connect();
    const unsub = skyMindWS.subscribe(handleWSMessage);

    const interval = setInterval(() => {
      setWsConnected(skyMindWS.connected);
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
      skyMindWS.disconnect();
    };
  }, [handleWSMessage, setWsConnected]);

  // Update drone markers on telemetry
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !maplibregl) return;

    const droneList = Object.values(drones);

    droneList.forEach(drone => {
      if (!drone.lat || !drone.lng) return;

      const existing = markersRef.current.get(drone.id);

      if (existing) {
        // Update position
        existing.setLngLat([drone.lng, drone.lat]);
        // Update marker element
        const el = createDroneMarkerElement(drone);
        existing.getElement().replaceWith(el);
        // Re-bind click
        el.addEventListener("click", () => {
          map.flyTo({ center: [drone.lng, drone.lat], zoom: 16, duration: 800 });
        });
      } else {
        // Create new marker
        const el = createDroneMarkerElement(drone);
        el.addEventListener("click", () => {
          map.flyTo({ center: [drone.lng, drone.lat], zoom: 16, duration: 800 });
        });

        const marker = new maplibregl!.Marker({ element: el, anchor: "center" })
          .setLngLat([drone.lng, drone.lat])
          .addTo(map);

        markersRef.current.set(drone.id, marker);
      }
    });

    // Remove markers for drones no longer in fleet
    markersRef.current.forEach((marker, id) => {
      if (!drones[id]) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [drones]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Zone drawer + path overlay (MapLibre layer components) */}
      <ZoneDrawer map={mapRef.current} />
      <PathOverlay map={mapRef.current} assignments={assignments} />

      {/* Drawing mode indicator */}
      {isDrawing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10
                        bg-blue-600 text-white text-sm font-semibold
                        px-4 py-2 rounded-full shadow-lg pointer-events-none">
          Click on map to add zone points — 3+ points required
        </div>
      )}

      {/* WS status dot */}
      <WSStatusDot />
    </div>
  );
}

function WSStatusDot() {
  const wsConnected = useFleetStore(s => s.wsConnected);
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5
                    bg-gray-900/80 px-2.5 py-1.5 rounded-full border border-gray-700">
      <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400" : "bg-red-500"}`} />
      <span className="text-xs text-gray-300">{wsConnected ? "Live" : "Offline"}</span>
    </div>
  );
}