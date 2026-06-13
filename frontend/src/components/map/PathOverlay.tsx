"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import type { ZoneAssignment } from "@/types";

interface PathOverlayProps {
  map: maplibregl.Map | null;
  assignments: ZoneAssignment[];
}

const ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
];

export default function PathOverlay({ map, assignments }: PathOverlayProps) {
  const layerIds = useRef<string[]>([]);

  useEffect(() => {
    if (!map || assignments.length === 0) return;

    // Clean up previous layers
    layerIds.current.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    layerIds.current = [];

    assignments.forEach((asn, i) => {
      if (!asn.waypoints || asn.waypoints.length < 2) return;

      const color = ZONE_COLORS[i % ZONE_COLORS.length];
      const sourceId = `path-${asn.zone_id}`;
      const layerId  = `path-line-${asn.zone_id}`;
      const dotId    = `path-dots-${asn.zone_id}`;

      const coordinates = asn.waypoints.map(wp => [wp.lng, wp.lat]);

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { zone_id: asn.zone_id, drone_id: asn.drone_id },
          geometry: { type: "LineString", coordinates },
        },
      });

      // Path line
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": color,
          "line-width": 2,
          "line-dasharray": [4, 2],
          "line-opacity": 0.8,
        },
      });

      // Waypoint dots
      map.addSource(`${sourceId}-dots`, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: coordinates.map((coord, wi) => ({
            type: "Feature",
            properties: { index: wi },
            geometry: { type: "Point", coordinates: coord },
          })),
        },
      });

      map.addLayer({
        id: dotId,
        type: "circle",
        source: `${sourceId}-dots`,
        paint: {
          "circle-radius": 3,
          "circle-color": color,
          "circle-opacity": 0.7,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      layerIds.current.push(sourceId, `${sourceId}-dots`, layerId, dotId);
    });

    return () => {
      layerIds.current.forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      });
    };
  }, [map, assignments]);

  return null;
}