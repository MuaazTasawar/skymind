"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { useMissionStore } from "@/store/missionStore";

interface ZoneDrawerProps {
  map: maplibregl.Map | null;
}

const SOURCE_ID = "drawing-zone";
const FILL_ID   = "drawing-zone-fill";
const LINE_ID   = "drawing-zone-line";
const DOTS_ID   = "drawing-zone-dots";

export default function ZoneDrawer({ map }: ZoneDrawerProps) {
  const { isDrawing, drawingZone, addDrawPoint, completeDrawing } = useMissionStore();
  const clickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);

  // Initialise map sources/layers once
  useEffect(() => {
    if (!map) return;

    const waitForLoad = () => {
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer(FILL_ID)) {
        map.addLayer({
          id: FILL_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 },
        });
      }

      if (!map.getLayer(LINE_ID)) {
        map.addLayer({
          id: LINE_ID,
          type: "line",
          source: SOURCE_ID,
          paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [4, 2] },
        });
      }

      if (!map.getLayer(DOTS_ID)) {
        map.addLayer({
          id: DOTS_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 5,
            "circle-color": "#3b82f6",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    };

    if (map.loaded()) waitForLoad();
    else map.once("load", waitForLoad);

    return () => {
      if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
      if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
      if (map.getLayer(DOTS_ID)) map.removeLayer(DOTS_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  // Update map geometry when drawing zone changes
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_ID)) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    const points = drawingZone?.points ?? [];

    if (points.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const features: GeoJSON.Feature[] = [
      // Dots at each point
      ...points.map((pt, i) => ({
        type: "Feature" as const,
        properties: { index: i },
        geometry: { type: "Point" as const, coordinates: pt },
      })),
    ];

    // Draw polygon if 3+ points
    if (points.length >= 3) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[...points, points[0]]],
        },
      });
    } else if (points.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points,
        },
      });
    }

    source.setData({ type: "FeatureCollection", features });
  }, [map, drawingZone]);

  // Attach/detach click handler based on drawing mode
  useEffect(() => {
    if (!map) return;

    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
      map.getCanvas().style.cursor = "";
    }

    if (!isDrawing) return;

    map.getCanvas().style.cursor = "crosshair";

    const handler = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      addDrawPoint([lng, lat]);
    };

    map.on("click", handler);
    clickHandlerRef.current = handler;

    return () => {
      map.off("click", handler);
      map.getCanvas().style.cursor = "";
    };
  }, [map, isDrawing, addDrawPoint]);

  return null; // All rendering is done via MapLibre layers
}