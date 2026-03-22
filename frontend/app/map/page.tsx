"use client";

import { useState, useEffect } from "react";
import { MapView, type MemberPin } from "@/components/map/MapView";
import { Sidebar } from "@/components/map/Sidebar";
import { IncidentCard } from "@/components/map/IncidentCard";
import { Legend } from "@/components/map/Legend";
import { useGroupLocations } from "@/hooks/useGroupLocations";
import { useAuthContext } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { Incident } from "@/types";

export default function MapPage() {
  const { user } = useAuthContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  // Get user's first group
  useEffect(() => {
    apiFetch("/api/groups")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setGroupId(data[0].id || data[0].group_id);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time group locations (falls back gracefully)
  const { members: realMembers, sharing, startSharing, stopSharing } =
    useGroupLocations(groupId, user?.id);

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

  const members: MemberPin[] = realMembers;

  if (!userLocation) {
    return (
      <div className="h-dvh bg-[#08080d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#4d7fff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex bg-[#08080d]">
      <Sidebar
        incidentCount={incidents.length}
        sharing={sharing}
        onToggleSharing={() => {
          if (sharing && groupId) {
            stopSharing(groupId);
          } else if (groupId) {
            startSharing(groupId, user?.name || "You");
          }
        }}
      />

      <div className="flex-1 relative">
        <MapView
          center={userLocation}
          incidents={incidents}
          members={members}
          onIncidentClick={setSelectedIncident}
        />

        <Legend />

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
