"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Incident } from "@/types";

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

export interface MemberPin {
  user_id?: string;
  name: string;
  lat: number;
  lng: number;
  isYou?: boolean;
  updated_at?: string;
}

interface MapViewProps {
  center: { lat: number; lng: number };
  incidents: Incident[];
  members: MemberPin[];
  onIncidentClick: (incident: Incident) => void;
  onMemberClick?: (member: MemberPin) => void;
}

function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function createMemberMarker(member: MemberPin): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  `;

  const bubble = document.createElement("div");
  bubble.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid ${member.isYou ? "#4d7fff" : "#22c55e"};
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    background: #1a1a2e;
  `;

  const img = document.createElement("img");
  img.src = avatarUrl(member.name);
  img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
  bubble.appendChild(img);

  const label = document.createElement("div");
  label.textContent = member.isYou ? "You" : member.name;
  label.style.cssText = `
    margin-top: 3px;
    font-size: 10px;
    font-weight: 600;
    color: white;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    padding: 1px 6px;
    border-radius: 6px;
    white-space: nowrap;
  `;

  wrapper.appendChild(bubble);
  wrapper.appendChild(label);
  return wrapper;
}

export function MapView({ center, incidents, members, onIncidentClick, onMemberClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const incidentMarkersRef = useRef<maplibregl.Marker[]>([]);
  const memberMarkersRef = useRef<maplibregl.Marker[]>([]);

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

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [center]);

  // Member markers
  useEffect(() => {
    if (!map.current) return;

    memberMarkersRef.current.forEach((m) => m.remove());
    memberMarkersRef.current = [];

    members.forEach((member) => {
      const el = createMemberMarker(member);
      if (onMemberClick) {
        el.addEventListener("click", () => onMemberClick(member));
      }
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([member.lng, member.lat])
        .addTo(map.current!);
      memberMarkersRef.current.push(marker);
    });
  }, [members, onMemberClick]);

  // Incident markers
  useEffect(() => {
    if (!map.current) return;

    incidentMarkersRef.current.forEach((m) => m.remove());
    incidentMarkersRef.current = [];

    incidents.forEach((incident) => {
      const color = CATEGORY_COLORS[incident.category] || "#6b7280";
      const isCommunity = incident.source === "community";
      const el = document.createElement("div");

      if (isCommunity) {
        // Diamond shape for community reports
        el.style.cssText = `
          width: 12px;
          height: 12px;
          background: ${color};
          border: 2px solid rgba(255,255,255,0.3);
          transform: rotate(45deg);
          cursor: pointer;
          box-shadow: 0 0 8px ${color}60;
        `;
      } else {
        // Circle for police/news
        el.style.cssText = `
          width: 10px;
          height: 10px;
          background: ${color};
          border: 1.5px solid rgba(0,0,0,0.4);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 6px ${color}50;
        `;
      }

      el.addEventListener("click", () => {
        onIncidentClick(incident);
        map.current?.flyTo({
          center: [incident.lng, incident.lat],
          zoom: 15,
          duration: 800,
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(map.current!);

      incidentMarkersRef.current.push(marker);
    });
  }, [incidents, onIncidentClick]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
