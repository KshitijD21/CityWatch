"use client";

import {
  X,
  Clock,
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
  MapPin,
} from "lucide-react";
import type { Incident } from "@/types";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string; bg: string; dot: string }> = {
  theft: { label: "Theft", icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10", dot: "bg-orange-500" },
  assault: { label: "Assault", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
  vandalism: { label: "Vandalism", icon: Wrench, color: "text-yellow-400", bg: "bg-yellow-500/10", dot: "bg-yellow-500" },
  harassment: { label: "Harassment", icon: Megaphone, color: "text-pink-400", bg: "bg-pink-500/10", dot: "bg-pink-500" },
  vehicle_breakin: { label: "Vehicle Break-in", icon: Car, color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  disturbance: { label: "Disturbance", icon: AlertTriangle, color: "text-purple-400", bg: "bg-purple-500/10", dot: "bg-purple-500" },
  infrastructure: { label: "Infrastructure", icon: Wrench, color: "text-cyan-400", bg: "bg-cyan-500/10", dot: "bg-cyan-500" },
  other: { label: "Other", icon: Shield, color: "text-white/50", bg: "bg-white/5", dot: "bg-white/50" },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  police: { label: "Police", icon: Radio, color: "text-blue-400" },
  news: { label: "News", icon: Newspaper, color: "text-amber-400" },
  community: { label: "Community", icon: Users, color: "text-emerald-400" },
};

interface IncidentCardProps {
  incident: Incident;
  onClose: () => void;
}

export function IncidentCard({ incident, onClose }: IncidentCardProps) {
  const cat = CATEGORY_CONFIG[incident.category] || CATEGORY_CONFIG.other;
  const src = SOURCE_CONFIG[incident.source] || { label: incident.source, icon: Shield, color: "text-white/40" };
  const CatIcon = cat.icon;
  const SrcIcon = src.icon;

  const occurredDate = new Date(incident.occurred_at);
  const timeAgo = getTimeAgo(incident.occurred_at);
  const formattedDate = occurredDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const formattedTime = occurredDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="absolute bottom-24 left-4 right-4 z-30 max-w-sm mx-auto">
      <div className="rounded-2xl border border-white/[0.08] bg-[#12121a]/95 backdrop-blur-md shadow-xl overflow-hidden">
        {/* Category header bar */}
        <div className={`px-4 py-2.5 ${cat.bg} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <CatIcon className={`size-4 ${cat.color}`} />
            <span className={`text-sm font-semibold ${cat.color}`}>
              {cat.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/30 hover:text-white/60 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Photo */}
        {(incident.photo_url || incident.image_url) && (
          <div className="relative h-36 overflow-hidden">
            <img
              src={incident.photo_url || incident.image_url}
              alt="Incident photo"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] to-transparent" />
          </div>
        )}

        <div className="p-4">
          {/* Description */}
          {incident.description && (
            <p className="text-sm text-white/60 leading-relaxed mb-3">
              {incident.description}
            </p>
          )}

          {/* Time */}
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-3.5 text-white/25" />
            <span className="text-xs text-white/40">
              {formattedDate} at {formattedTime}
            </span>
            <span className="text-[10px] text-white/25 px-1.5 py-0.5 rounded-full bg-white/[0.04]">
              {timeAgo}
            </span>
          </div>

          {/* Source + Verified badges */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] text-xs ${src.color}`}>
              <SrcIcon className="size-3" />
              {src.label}
            </div>
            {incident.verified && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-xs text-emerald-400">
                <CheckCircle2 className="size-3" />
                Verified
              </div>
            )}
            {incident.distance_miles != null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] text-xs text-white/30 ml-auto">
                <MapPin className="size-3" />
                {incident.distance_miles.toFixed(1)} mi
              </div>
            )}
          </div>

          {/* Report count */}
          {incident.report_count > 1 && (
            <div className="mt-2 text-[10px] text-white/20">
              Reported {incident.report_count} times
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
