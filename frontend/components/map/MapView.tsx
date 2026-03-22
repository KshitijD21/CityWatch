"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Incident } from "@/types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: false,
    });

    // Add user location dot
    new mapboxgl.Marker({
      color: "#4d7fff",
      scale: 0.8,
    })
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
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
      el.className = "incident-marker";
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

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [incidents, onIncidentClick]);

  return (
    <div ref={mapContainer} className="absolute inset-0" />
  );
}
