"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { apiFetch } from "@/lib/api";
import type { MemberPin } from "@/components/map/MapView";

interface LocationPayload {
  user_id: string;
  display_name: string;
  lat: number;
  lng: number;
}

export function useGroupLocations(groupId: string | null, currentUserId?: string) {
  const [members, setMembers] = useState<MemberPin[]>([]);
  const [sharing, setSharing] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const publishIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial locations from REST API
  useEffect(() => {
    if (!groupId) return;

    apiFetch(`/api/location/group/${groupId}`)
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(
            data.map((m: { user_id: string; display_name: string; lat: number; lng: number; updated_at?: string }) => ({
              user_id: m.user_id,
              name: m.display_name || "Unknown",
              lat: m.lat,
              lng: m.lng,
              isYou: m.user_id === currentUserId,
              updated_at: m.updated_at,
            }))
          );
        }
      })
      .catch(() => {});
  }, [groupId, currentUserId]);

  // Subscribe to realtime location updates
  useEffect(() => {
    if (!groupId) return;

    const channel = `group:${groupId}:locations`;

    async function connect() {
      try {
        await insforge.realtime.connect();
        await insforge.realtime.subscribe(channel);

        insforge.realtime.on("location_update", (payload: LocationPayload) => {
          setMembers((prev) => {
            const existing = prev.findIndex(
              (m) => m.name === payload.display_name
            );
            const pin: MemberPin = {
              user_id: payload.user_id,
              name: payload.display_name,
              lat: payload.lat,
              lng: payload.lng,
              isYou: payload.user_id === currentUserId,
            };

            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = pin;
              return updated;
            }
            return [...prev, pin];
          });
        });
      } catch {
        // Realtime not available — fall back to REST only
      }
    }

    connect();

    return () => {
      try {
        insforge.realtime.unsubscribe(channel);
      } catch {}
    };
  }, [groupId, currentUserId]);

  // Start sharing location
  const startSharing = useCallback(
    async (groupId: string, displayName: string) => {
      try {
        await apiFetch("/api/location/sharing", {
          method: "PUT",
          body: JSON.stringify({ group_id: groupId, sharing_location: true }),
        });
      } catch {}

      setSharing(true);
      const channel = `group:${groupId}:locations`;

      // Publish GPS every 5 seconds
      function publishLocation(pos: GeolocationPosition) {
        const payload = {
          user_id: currentUserId || "unknown",
          display_name: displayName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        try {
          insforge.realtime.publish(channel, "location_update", payload);
        } catch {}
      }

      // Watch position
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          publishLocation,
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      }
    },
    [currentUserId]
  );

  // Stop sharing
  const stopSharing = useCallback(
    async (groupId: string) => {
      setSharing(false);

      try {
        await apiFetch("/api/location/sharing", {
          method: "PUT",
          body: JSON.stringify({ group_id: groupId, sharing_location: false }),
        });
      } catch {}

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (publishIntervalRef.current) {
        clearInterval(publishIntervalRef.current);
        publishIntervalRef.current = null;
      }
    },
    []
  );

  return { members, sharing, startSharing, stopSharing };
}
