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

function buildGeoJSON(incidents: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: incidents.map((inc, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [inc.lng, inc.lat] },
      properties: {
        idx: i,
        category: inc.category,
        source: inc.source,
        color: CATEGORY_COLORS[inc.category] || "#6b7280",
      },
    })),
  };
}

const INCIDENTS_SOURCE = "incidents-source";
const POLICE_NEWS_LAYER = "incidents-police-news";
const POLICE_NEWS_GLOW = "incidents-police-news-glow";
const COMMUNITY_LAYER = "incidents-community";
const COMMUNITY_GLOW = "incidents-community-glow";

export function MapView({ center, incidents, members, onIncidentClick, onMemberClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const memberMarkersRef = useRef<maplibregl.Marker[]>([]);
  const incidentsRef = useRef<Incident[]>([]);
  const mapReady = useRef(false);

  // Keep incidents ref in sync for click handler
  incidentsRef.current = incidents;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: false,
    });

    m.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    m.on("load", () => {
      // Add empty source
      m.addSource(INCIDENTS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Glow layer for police/news (larger, blurred circle behind)
      m.addLayer({
        id: POLICE_NEWS_GLOW,
        type: "circle",
        source: INCIDENTS_SOURCE,
        filter: ["!=", ["get", "source"], "community"],
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.25,
          "circle-blur": 1,
        },
      });

      // Police/news circles
      m.addLayer({
        id: POLICE_NEWS_LAYER,
        type: "circle",
        source: INCIDENTS_SOURCE,
        filter: ["!=", ["get", "source"], "community"],
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(0,0,0,0.4)",
          "circle-opacity": 0.9,
        },
      });

      // Glow layer for community
      m.addLayer({
        id: COMMUNITY_GLOW,
        type: "circle",
        source: INCIDENTS_SOURCE,
        filter: ["==", ["get", "source"], "community"],
        paint: {
          "circle-radius": 8,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.25,
          "circle-blur": 1,
        },
      });

      // Community circles (slightly larger with white border)
      m.addLayer({
        id: COMMUNITY_LAYER,
        type: "circle",
        source: INCIDENTS_SOURCE,
        filter: ["==", ["get", "source"], "community"],
        paint: {
          "circle-radius": 6,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
          "circle-opacity": 0.9,
        },
      });

      mapReady.current = true;

      // If incidents were set before map loaded, apply them now
      if (incidentsRef.current.length > 0) {
        const src = m.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource;
        src?.setData(buildGeoJSON(incidentsRef.current));
      }
    });

    // Click handler for incident layers
    const handleClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const features = e.features;
      if (!features || features.length === 0) return;
      const idx = features[0].properties?.idx;
      if (idx == null) return;
      const incident = incidentsRef.current[idx];
      if (!incident) return;

      onIncidentClick(incident);
      m.flyTo({ center: [incident.lng, incident.lat], zoom: 15, duration: 800 });
    };

    m.on("click", POLICE_NEWS_LAYER, handleClick);
    m.on("click", COMMUNITY_LAYER, handleClick);

    // Pointer cursor on hover
    m.on("mouseenter", POLICE_NEWS_LAYER, () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", POLICE_NEWS_LAYER, () => { m.getCanvas().style.cursor = ""; });
    m.on("mouseenter", COMMUNITY_LAYER, () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", COMMUNITY_LAYER, () => { m.getCanvas().style.cursor = ""; });

    map.current = m;

    return () => {
      map.current?.remove();
      map.current = null;
      mapReady.current = false;
    };
  }, [center]);

  // Update incident data
  useEffect(() => {
    if (!map.current || !mapReady.current) return;
    const src = map.current.getSource(INCIDENTS_SOURCE) as maplibregl.GeoJSONSource;
    if (!src) return;
    src.setData(buildGeoJSON(incidents));
  }, [incidents]);

  // Member markers (DOM-based — only a few members, fine as DOM)
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

  return <div ref={mapContainer} className="w-full h-full" />;
}
