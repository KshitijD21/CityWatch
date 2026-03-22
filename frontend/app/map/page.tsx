'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapView, type MemberPin } from '@/components/map/MapView';
import { Sidebar } from '@/components/map/Sidebar';
import { IncidentCard } from '@/components/map/IncidentCard';
import { ReportModal } from '@/components/map/ReportModal';
import { AlertTriangle } from 'lucide-react';
import { MemberProfilePanel } from '@/components/map/MemberProfilePanel';
import { Legend } from '@/components/map/Legend';
import { AlertsPanel } from '@/components/map/AlertsPanel';
import { useGroupLocations } from '@/hooks/useGroupLocations';
import { useAuthContext } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import type { Incident } from '@/types';

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh bg-[#08080d] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#4d7fff] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}

function MapPageContent() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const focusUserId = searchParams.get('focus');
  const hasFocused = useRef(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberPin | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [sourceFilters, setSourceFilters] = useState<Record<string, boolean>>({
    police: true,
    news: true,
    community: true,
  });
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({});

  // Get user's first group
  useEffect(() => {
    apiFetch('/api/groups')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setGroupId(data[0].id || data[0].group_id);
        }
      })
      .catch(() => {});
  }, []);

  // Real-time group locations (falls back gracefully)
  const {
    members: realMembers,
    sharing,
    startSharing,
    stopSharing,
  } = useGroupLocations(groupId, user?.id, user?.name);

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
      `/api/incidents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=10`
    )
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [userLocation]);

  const filteredIncidents = incidents.filter(
    (inc) => sourceFilters[inc.source] !== false && categoryFilters[inc.category] !== false
  );

  function toggleSource(source: string) {
    setSourceFilters((prev) => ({ ...prev, [source]: !prev[source] }));
  }

  function toggleCategory(category: string) {
    setCategoryFilters((prev) => ({ ...prev, [category]: prev[category] === false ? true : false }));
  }

  // Show real members, always include "You" pin
  const members: MemberPin[] = userLocation
    ? [
        {
          user_id: user?.id,
          name: user?.name || 'You',
          lat: userLocation.lat,
          lng: userLocation.lng,
          isYou: true,
        },
        ...realMembers.filter((m) => !m.isYou),
      ]
    : realMembers;

  // Auto-focus on a member if ?focus=userId is in the URL
  useEffect(() => {
    if (!focusUserId || hasFocused.current || members.length === 0) return;
    const target = members.find((m) => m.user_id === focusUserId);
    if (target) {
      hasFocused.current = true;
      setSelectedMember(target);
    }
  }, [focusUserId, members]);

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
        incidentCount={filteredIncidents.length}
        sharing={sharing}
        onToggleSharing={() => {
          if (sharing && groupId) {
            stopSharing(groupId);
          } else if (groupId) {
            startSharing(groupId, user?.name || 'You');
          }
        }}
        alertsOpen={showAlerts}
        onToggleAlerts={() => setShowAlerts(!showAlerts)}
      />

      <div className="flex-1 relative">
        <MapView
          center={userLocation}
          incidents={filteredIncidents}
          members={members}
          onIncidentClick={setSelectedIncident}
          onMemberClick={(m) => {
            setSelectedMember(m);
            setSelectedIncident(null);
          }}
        />

        <Legend
          sourceFilters={sourceFilters}
          onToggleSource={toggleSource}
          categoryFilters={categoryFilters}
          onToggleCategory={toggleCategory}
        />

        {selectedIncident && (
          <IncidentCard
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        )}

        {selectedMember && (
          <MemberProfilePanel
            member={selectedMember}
            onClose={() => setSelectedMember(null)}
          />
        )}

        {/* Floating report button */}
        <button
          onClick={() => setShowReport(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 h-11 px-5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 text-sm font-medium flex items-center gap-2 shadow-lg backdrop-blur-md transition-colors cursor-pointer"
        >
          <AlertTriangle className="size-4" />
          Report
        </button>

        {/* Report modal */}
        {showReport && userLocation && (
          <ReportModal
            userLocation={userLocation}
            onClose={() => setShowReport(false)}
            onSubmitted={() => {
              // Refresh incidents after submission
              apiFetch(
                `/api/incidents/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}&radius=2`
              )
                .then((data) => setIncidents(Array.isArray(data) ? data : []))
                .catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}
