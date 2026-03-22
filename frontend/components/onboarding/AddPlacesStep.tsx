"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { AddressInput } from "./AddressInput";
import { MapPin, Home, Building2, Plus, Loader2, Navigation } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Place {
  name: string;
  address: string;
  type: string;
}

interface AddPlacesStepProps {
  onContinue: () => void;
}

export function AddPlacesStep({ onContinue }: AddPlacesStepProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [homeAddress, setHomeAddress] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState<string | null>(null);

  // Auto-fetch home address on mount
  useEffect(() => {
    setLocating("home");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.display_name?.split(",").slice(0, 3).join(",").trim();
          setHomeAddress(addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setHomeAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setLocating(null);
      },
      () => setLocating(null),
      { timeout: 5000 }
    );
  }, []);

  async function useGPS(field: "home" | "work") {
    setLocating(field);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const addr = data.display_name?.split(",").slice(0, 3).join(",").trim();
        const address = addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        if (field === "home") setHomeAddress(address);
        else setWorkAddress(address);
      } catch {
        const address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        if (field === "home") setHomeAddress(address);
        else setWorkAddress(address);
      }
    } catch {
      // silently fail
    } finally {
      setLocating(null);
    }
  }

  async function handleFinish() {
    setLoading(true);

    try {
      const toSave: Place[] = [];
      if (homeAddress.trim()) {
        toSave.push({ name: "Home", address: homeAddress.trim(), type: "home" });
      }
      if (workAddress.trim()) {
        toSave.push({ name: "Work / School", address: workAddress.trim(), type: "work" });
      }

      for (const place of toSave) {
        await apiFetch("/api/places", {
          method: "POST",
          body: JSON.stringify(place),
        }).catch(() => {});
      }

      setPlaces(toSave);
    } catch {
      // continue anyway
    } finally {
      setLoading(false);
      onContinue();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center">
          <MapPin className="size-5 text-[#7ba4ff]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Add places you care about</h2>
          <p className="text-xs text-white/40">
            We&apos;ll send relevant safety info for these areas
          </p>
        </div>
      </div>

      <div className="space-y-5 mt-6">
        {/* Home */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Home className="size-4 text-white/40" />
            <label className="text-sm font-medium text-white/70">Home</label>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="123 Main St, Phoenix"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:ring-[#4d7fff]/50"
              />
            </div>
            <button
              onClick={() => useGPS("home")}
              className="h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            >
              {locating === "home" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Navigation className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Work/School */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="size-4 text-white/40" />
            <label className="text-sm font-medium text-white/70">Work / School</label>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <AddressInput
                placeholder="456 University Ave"
                value={workAddress}
                onChange={setWorkAddress}
              />
            </div>
            <button
              onClick={() => useGPS("work")}
              className="h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
            >
              {locating === "work" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Navigation className="size-4" />
              )}
            </button>
          </div>
        </div>

        {/* Saved places preview */}
        {places.length > 0 && (
          <div className="space-y-2">
            {places.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <Plus className="size-3.5 text-emerald-400" />
                <span className="text-sm text-white/60">{p.name}</span>
                <span className="text-xs text-white/25 ml-auto">{p.address}</span>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleFinish}
          disabled={loading}
          className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Go to Map"}
        </Button>

        <button
          onClick={onContinue}
          className="w-full text-center text-sm text-white/30 hover:text-white/50 transition-colors cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
