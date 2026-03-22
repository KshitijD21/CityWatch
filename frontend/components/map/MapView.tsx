"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Incident } from "@/types";

// Free dark tile style (no API key needed)
const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CATEGORY_COLORS: Record<string, string> = {
  theft: "#ef4444",
  assault: "#dc2626",
  vandalism: "#f97316",
  harassment: "#eab308",
  vehicle_breakin: "#ef4444",
  disturbance: "#f59e0b",
  infrastructure: "#3b82f6",
  other: "#6b7280",
};

interface MapViewProps {
  center: { lat: number; lng: number };
  incidents: Incident[];
  onIncidentClick: (incident: Incident) => void;
}

export function MapView({ center, incidents, onIncidentClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: false,
    });

    // Add user location dot
    const userEl = document.createElement("div");
    userEl.style.cssText = `
      width: 16px;
      height: 16px;
      background: #4d7fff;
      border: 3px solid #1a1a2e;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(77, 127, 255, 0.5);
    `;

    new maplibregl.Marker({ element: userEl })
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center]);

  // Update incident markers
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    incidents.forEach((incident) => {
      const color = CATEGORY_COLORS[incident.category] || "#6b7280";
      const el = document.createElement("div");
      el.style.cssText = `
        width: 14px;
        height: 14px;
        background: ${color};
        border: 2px solid rgba(0,0,0,0.3);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 8px ${color}60;
      `;

      el.addEventListener("click", () => onIncidentClick(incident));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [incidents, onIncidentClick]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
