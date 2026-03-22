"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  Sun,
  Sunset,
  Moon,
  Info,
  Loader2,
  Eye,
  ShieldAlert,
  Wrench,
  Megaphone,
  Car,
  AlertTriangle,
  Radio,
  Newspaper,
  Users,
  MapPin,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface BriefData {
  summary: string;
  time_breakdown: {
    daytime: string;
    evening: string;
    late_night: string;
  };
  by_category?: Record<string, number>;
  sources: { name: string; type: string; count: number }[];
  incident_count: number;
  disclaimer: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string; bg: string }> = {
  theft: { label: "Theft", icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10" },
  assault: { label: "Assault", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
  vandalism: { label: "Vandalism", icon: Wrench, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  harassment: { label: "Harassment", icon: Megaphone, color: "text-pink-400", bg: "bg-pink-500/10" },
  vehicle_breakin: { label: "Vehicle Break-in", icon: Car, color: "text-amber-400", bg: "bg-amber-500/10" },
  disturbance: { label: "Disturbance", icon: AlertTriangle, color: "text-purple-400", bg: "bg-purple-500/10" },
  infrastructure: { label: "Infrastructure", icon: Wrench, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  other: { label: "Other", icon: Shield, color: "text-white/50", bg: "bg-white/5" },
};

const SOURCE_CONFIG: Record<string, { icon: typeof Shield; color: string }> = {
  police: { icon: Radio, color: "text-blue-400" },
  news: { icon: Newspaper, color: "text-amber-400" },
  community: { icon: Users, color: "text-emerald-400" },
};

// Extract number from time breakdown text like "16 incidents: ..."
function extractCount(text: string): number {
  const match = text.match(/^(\d+)\s+incidents?/);
  return match ? parseInt(match[1]) : 0;
}

export default function BriefPage() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSources, setShowSources] = useState(false);

  useEffect(() => {
    function fetchBrief(lat: number, lng: number) {
      apiFetch(`/api/briefs/generate?lat=${lat}&lng=${lng}`)
        .then((data) => setBrief(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchBrief(pos.coords.latitude, pos.coords.longitude),
      () => fetchBrief(33.4255, -111.94),
      { timeout: 5000 }
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

      <div className="px-4 py-6 max-w-lg mx-auto">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {/* Hero skeleton */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-white/[0.06] rounded mb-2" />
                  <div className="h-3 w-36 bg-white/[0.04] rounded" />
                </div>
                <div className="h-8 w-12 bg-white/[0.06] rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-white/[0.04] rounded" />
                <div className="h-3 w-5/6 bg-white/[0.04] rounded" />
                <div className="h-3 w-4/6 bg-white/[0.04] rounded" />
              </div>
            </div>
            {/* Category breakdown skeleton */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="h-4 w-36 bg-white/[0.06] rounded mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.06]" />
                    <div className="flex-1">
                      <div className="h-3 w-20 bg-white/[0.05] rounded mb-1.5" />
                      <div className="h-1.5 w-full bg-white/[0.04] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Time of day skeleton */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="h-4 w-28 bg-white/[0.06] rounded mb-4" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-center">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] mx-auto mb-2" />
                    <div className="h-5 w-8 bg-white/[0.06] rounded mx-auto mb-1" />
                    <div className="h-2.5 w-12 bg-white/[0.04] rounded mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : brief ? (
          <div className="space-y-4">
            {/* Hero stat */}
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#4d7fff]/5 to-transparent p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center">
                  <MapPin className="size-5 text-[#7ba4ff]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Your Area</h2>
                  <p className="text-[11px] text-white/30">Last 7 days · 5 mile radius</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-[#7ba4ff]">{brief.incident_count}</p>
                  <p className="text-[10px] text-white/30">incidents</p>
                </div>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">{brief.summary}</p>
            </div>

            {/* Category breakdown */}
            {brief.by_category && Object.keys(brief.by_category).length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-4 text-white/40" />
                  <h3 className="text-sm font-semibold">Incident Breakdown</h3>
                </div>
                <div className="space-y-2.5">
                  {Object.entries(brief.by_category)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => {
                      const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
                      const Icon = cfg.icon;
                      const pct = Math.round((count / brief.incident_count) * 100);
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`size-3.5 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-white/70">{cfg.label}</span>
                              <span className="text-xs text-white/40">{count}</span>
                            </div>
                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${cfg.bg.replace("/10", "/40")}`}
                                style={{ width: `${Math.max(pct, 3)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Time of day */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold mb-4">By Time of Day</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Sun, label: "Day", color: "text-amber-400", bg: "bg-amber-500/10", data: brief.time_breakdown.daytime },
                  { icon: Sunset, label: "Evening", color: "text-orange-400", bg: "bg-orange-500/10", data: brief.time_breakdown.evening },
                  { icon: Moon, label: "Night", color: "text-blue-400", bg: "bg-blue-500/10", data: brief.time_breakdown.late_night },
                ].map((period) => {
                  const count = extractCount(period.data);
                  const Icon = period.icon;
                  return (
                    <div
                      key={period.label}
                      className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 text-center"
                    >
                      <div className={`w-8 h-8 rounded-lg ${period.bg} flex items-center justify-center mx-auto mb-2`}>
                        <Icon className={`size-4 ${period.color}`} />
                      </div>
                      <p className="text-lg font-bold text-white/80">{count}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{period.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { icon: Sun, label: "Daytime (6am–6pm)", data: brief.time_breakdown.daytime, color: "text-amber-400" },
                  { icon: Sunset, label: "Evening (6pm–10pm)", data: brief.time_breakdown.evening, color: "text-orange-400" },
                  { icon: Moon, label: "Late Night (10pm–6am)", data: brief.time_breakdown.late_night, color: "text-blue-400" },
                ].map((period) => {
                  const Icon = period.icon;
                  return (
                    <div key={period.label} className="flex items-start gap-2.5 px-2 py-1.5">
                      <Icon className={`size-3.5 ${period.color} mt-0.5 shrink-0`} />
                      <div>
                        <p className="text-[11px] font-medium text-white/50">{period.label}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">{period.data}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sources */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-sm text-[#7ba4ff] cursor-pointer w-full"
              >
                <Info className="size-4" />
                <span>How we know this</span>
              </button>

              {showSources && (
                <div className="mt-4 space-y-2.5">
                  {brief.sources.map((src, i) => {
                    const srcCfg = SOURCE_CONFIG[src.type] || { icon: Shield, color: "text-white/40" };
                    const SrcIcon = srcCfg.icon;
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SrcIcon className={`size-3.5 ${srcCfg.color}`} />
                          <span className="text-sm text-white/50">{src.name}</span>
                        </div>
                        <span className="text-xs text-white/25">{src.count} reports</span>
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-white/15 leading-relaxed pt-2 border-t border-white/[0.04]">
                    {brief.disclaimer}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Shield className="size-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-sm">Unable to load safety brief.</p>
            <p className="text-white/25 text-xs mt-2">Please allow location access and try again.</p>
          </div>
        )}
      </div>
    </div>
  );
}
