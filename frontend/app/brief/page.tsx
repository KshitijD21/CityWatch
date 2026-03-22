"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, ArrowLeft, Sun, Sunset, Moon, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { BriefResponse } from "@/types";

export default function BriefPage() {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        apiFetch(
          `/api/briefs?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
        )
          .then((data) => setBrief(data))
          .catch(() => {})
          .finally(() => setLoading(false));
      },
      () => setLoading(false)
    );
  }, []);

  return (
    <div className="min-h-dvh bg-[#08080d] text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <Link href="/map" className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#6c9cff]" />
          <span className="text-sm font-semibold">Safety Brief</span>
        </div>
      </div>

      <div className="px-6 py-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 text-[#4d7fff] animate-spin" />
          </div>
        ) : brief ? (
          <>
            {/* Summary */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
              <h2 className="text-base font-semibold mb-3">Area Summary</h2>
              <p className="text-sm text-white/50 leading-relaxed">{brief.summary}</p>
              <div className="mt-3 text-xs text-white/25">
                Based on {brief.incident_count} recent incidents
              </div>
            </div>

            {/* Time breakdown */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
              <h3 className="text-sm font-semibold mb-4">By Time of Day</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Sun className="size-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-white/60">Daytime</span>
                    <p className="text-sm text-white/40 mt-0.5">{brief.time_breakdown.daytime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sunset className="size-4 text-orange-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-white/60">Evening</span>
                    <p className="text-sm text-white/40 mt-0.5">{brief.time_breakdown.evening}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Moon className="size-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-white/60">Late Night</span>
                    <p className="text-sm text-white/40 mt-0.5">{brief.time_breakdown.late_night}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sources */}
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-sm text-[#7ba4ff] mb-4 cursor-pointer"
            >
              <Info className="size-4" />
              How we know this
            </button>

            {showSources && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
                <h3 className="text-sm font-semibold mb-3">Sources</h3>
                <div className="space-y-2">
                  {brief.sources.map((src, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-white/50">{src.name}</span>
                      <span className="text-xs text-white/25">{src.count} reports</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-white/20 leading-relaxed">
                  {brief.disclaimer}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-white/40 text-sm">Unable to load safety brief.</p>
            <p className="text-white/25 text-xs mt-2">Please allow location access and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
