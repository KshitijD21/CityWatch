"use client";

import { useState, useEffect } from "react";
import { MapView } from "@/components/map/MapView";
import { Sidebar } from "@/components/map/Sidebar";
import { IncidentCard } from "@/components/map/IncidentCard";
import { apiFetch } from "@/lib/api";
import type { Incident } from "@/types";

export default function MapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location with fast fallback
  useEffect(() => {
    const fallback = setTimeout(() => {
      setUserLocation((prev) => prev ?? { lat: 33.4255, lng: -111.94 });
    }, 2000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallback);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        clearTimeout(fallback);
        setUserLocation({ lat: 33.4255, lng: -111.94 });
      },
      { timeout: 5000 }
    );

    return () => clearTimeout(fallback);
  }, []);

  // Fetch nearby incidents
  useEffect(() => {
    if (!userLocation) return;

    apiFetch(
      `/api/incidents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=5`
    )
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [userLocation]);

  if (!userLocation) {
    return (
      <div className="h-dvh bg-[#08080d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4d7fff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex bg-[#08080d]">
      {/* Sidebar */}
      <Sidebar incidentCount={incidents.length} />

      {/* Map area */}
      <div className="flex-1 relative">
        <MapView
          center={userLocation}
          incidents={incidents}
          onIncidentClick={setSelectedIncident}
        />

        {selectedIncident && (
          <IncidentCard
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        )}
      </div>
    </div>
  );
}
