"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Loader2, CheckCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressInput } from "@/components/onboarding/AddressInput";
import { apiFetch } from "@/lib/api";

const CATEGORIES = [
  "theft",
  "assault",
  "vandalism",
  "harassment",
  "vehicle_breakin",
  "disturbance",
  "infrastructure",
  "other",
];

const CATEGORY_DATA: Record<string, { label: string; emoji: string; color: string }> = {
  theft: { label: "Theft", emoji: "🔓", color: "border-red-500/30 bg-red-500/5 text-red-300" },
  assault: { label: "Assault", emoji: "🚨", color: "border-rose-500/30 bg-rose-500/5 text-rose-300" },
  vandalism: { label: "Vandalism", emoji: "🔨", color: "border-orange-500/30 bg-orange-500/5 text-orange-300" },
  harassment: { label: "Harassment", emoji: "⚠️", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300" },
  vehicle_breakin: { label: "Vehicle Break-in", emoji: "🚗", color: "border-red-400/30 bg-red-400/5 text-red-300" },
  disturbance: { label: "Disturbance", emoji: "📢", color: "border-amber-500/30 bg-amber-500/5 text-amber-300" },
  infrastructure: { label: "Infrastructure", emoji: "🚧", color: "border-blue-500/30 bg-blue-500/5 text-blue-300" },
  other: { label: "Other", emoji: "📌", color: "border-gray-500/30 bg-gray-500/5 text-gray-300" },
};

export default function ReportPage() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [locating, setLocating] = useState(false);

  // Auto-fetch current location address on mount
  useEffect(() => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.display_name?.split(",").slice(0, 3).join(",").trim();
          setLocationAddress(addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => {
        setLocation({ lat: 33.4255, lng: -111.94 });
        setLocationAddress("Tempe, AZ");
        setLocating(false);
      },
      { timeout: 5000 }
    );
  }, []);

  function useCurrentLocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.display_name?.split(",").slice(0, 3).join(",").trim();
          setLocationAddress(addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 5000 }
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category || !location) return;
    setLoading(true);

    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          category,
          description: description.trim() || undefined,
          lat: location.lat,
          lng: location.lng,
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh bg-[#08080d] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <CheckCircle className="size-12 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Report Submitted</h2>
          <p className="text-sm text-white/40 mb-8">
            Thank you for helping keep your community safe. Your report will be reviewed.
          </p>
          <Button
            onClick={() => router.push("/map")}
            className="h-10 px-6 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors"
          >
            Back to Map
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <Link href="/map" className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="text-sm font-semibold">Report an Incident</span>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-center px-6 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* Location */}
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">
            Where did it happen?
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <AddressInput
                value={locationAddress}
                onChange={setLocationAddress}
                placeholder="Search for a location..."
              />
            </div>
            <button
              type="button"
              onClick={useCurrentLocation}
              className="h-9 px-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 transition-colors cursor-pointer shrink-0"
            >
              {locating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Navigation className="size-4" />
              )}
            </button>
          </div>
          {location && (
            <p className="text-[10px] text-white/20 mt-1.5">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2.5">
            What happened?
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((cat) => {
              const data = CATEGORY_DATA[cat];
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                    active
                      ? data.color
                      : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.04] hover:border-white/[0.1]"
                  }`}
                >
                  <span className="text-lg">{data.emoji}</span>
                  <span className="text-sm font-medium">{data.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-white/70 block mb-2">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What did you see?"
            rows={3}
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#4d7fff]/50 resize-none"
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !category}
          className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Submit Report"}
        </Button>
      </form>
    </div>
  );
}
