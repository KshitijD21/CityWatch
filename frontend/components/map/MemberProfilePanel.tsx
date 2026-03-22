"use client";

import { useEffect, useState } from "react";
import {
  X,
  Clock,
  MapPin,
  Shield,
  Eye,
  ShieldAlert,
  Wrench,
  Megaphone,
  Car,
  AlertTriangle,
  Radio,
  Newspaper,
  Users,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { MemberPin } from "./MapView";
import type { Incident } from "@/types";

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

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  police: { label: "Police", icon: Radio, color: "text-blue-400" },
  news: { label: "News", icon: Newspaper, color: "text-amber-400" },
  community: { label: "Community", icon: Users, color: "text-emerald-400" },
};

function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface MemberProfilePanelProps {
  member: MemberPin;
  onClose: () => void;
}

export function MemberProfilePanel({ member, onClose }: MemberProfilePanelProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);

  // Fetch nearby incidents (last 7 days) around the member's location
  useEffect(() => {
    setLoading(true);
    apiFetch(
      `/api/incidents/nearby?lat=${member.lat}&lng=${member.lng}&radius=2&days=7`
    )
      .then((data) => setIncidents(Array.isArray(data) ? data : []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, [member.lat, member.lng]);

  // Reverse geocode via Nominatim (same as backend chat/geocoding.py)
  useEffect(() => {
    async function reverseGeocode() {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${member.lat}&lon=${member.lng}&format=json&zoom=18`,
          { headers: { "User-Agent": "CityWatch/1.0" } }
        );
        const data = await res.json();
        const display = data?.display_name;
        if (display) {
          // Shorten: keep first 2-3 parts like backend does
          const parts = display.split(", ");
          setAddress(parts.length > 3 ? parts.slice(0, 3).join(", ") : display);
          return;
        }
      } catch {}
      setAddress(`${member.lat.toFixed(4)}, ${member.lng.toFixed(4)}`);
    }

    reverseGeocode();
  }, [member.lat, member.lng]);

  return (
    <div className="absolute top-0 right-0 h-full w-96 z-40 flex flex-col bg-[#0c0c14]/95 backdrop-blur-md border-l border-white/[0.08] shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="p-5 flex items-start gap-4 border-b border-white/[0.06]">
        <div className="w-14 h-14 rounded-full border-3 border-[#22c55e] overflow-hidden bg-[#1a1a2e] shrink-0">
          <img
            src={avatarUrl(member.name)}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-lg truncate">
            {member.isYou ? "You" : member.name}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <MapPin className="size-3 text-white/30 shrink-0" />
            <span className="text-xs text-white/40 truncate">
              {address || `${member.lat.toFixed(4)}, ${member.lng.toFixed(4)}`}
            </span>
          </div>
          {(() => {
            const isOnline = member.isYou || (member.updated_at && (Date.now() - new Date(member.updated_at).getTime()) < 5 * 60 * 1000);
            return (
              <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                isOnline
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-white/[0.04] text-white/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-white/20"}`} />
                {isOnline ? "Active now" : member.updated_at ? `Last seen ${getTimeAgo(member.updated_at)}` : "Last known location"}
              </span>
            );
          })()}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Incidents section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">
            Last 7 Days Nearby
          </h3>
          <span className="text-[10px] text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">
            {loading ? "..." : `${incidents.length} events`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-[#4d7fff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="size-8 text-emerald-400/40 mx-auto mb-2" />
            <p className="text-sm text-white/30">No incidents nearby</p>
            <p className="text-xs text-white/20 mt-1">This area looks safe!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {incidents.map((incident) => {
              const cat = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.other;
              const src = SOURCE_CONFIG[incident.source] || { label: incident.source, icon: Shield, color: "text-white/40" };
              const CatIcon = cat.icon;
              const SrcIcon = src.icon;

              return (
                <div
                  key={incident.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors overflow-hidden"
                >
                  {/* Category bar */}
                  <div className={`px-3 py-1.5 ${cat.bg} flex items-center gap-2`}>
                    <CatIcon className={`size-3.5 ${cat.color}`} />
                    <span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span>
                  </div>

                  <div className="p-3">
                    {/* Description */}
                    {incident.description && (
                      <p className="text-xs text-white/50 leading-relaxed mb-2 line-clamp-2">
                        {incident.description}
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {getTimeAgo(incident.occurred_at)}
                      </div>
                      {incident.distance_miles != null && (
                        <div className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {incident.distance_miles.toFixed(1)} mi
                        </div>
                      )}
                      <div className={`flex items-center gap-1 ${src.color}`}>
                        <SrcIcon className="size-3" />
                        {src.label}
                      </div>
                      {incident.verified && (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="size-3" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
