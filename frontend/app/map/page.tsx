"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/AuthContext";
import { MapView } from "@/components/map/MapView";
import { BottomBar } from "@/components/map/BottomBar";
import { TopBar } from "@/components/map/TopBar";
import { IncidentCard } from "@/components/map/IncidentCard";
import { apiFetch } from "@/lib/api";
import type { Incident } from "@/types";

export default function MapPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // TODO: Re-enable auth guard after hackathon demo
  // useEffect(() => {
  //   if (!authLoading && !user) {
  //     router.push("/login");
  //   }
  // }, [user, authLoading, router]);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Default to Phoenix, AZ (ASU area)
        setUserLocation({ lat: 33.4255, lng: -111.9400 });
      }
    );
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
    <div className="h-dvh w-full relative overflow-hidden">
      <TopBar />

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

      <BottomBar />
    </div>
  );
}
