"use client";

import { X } from "lucide-react";
import type { Incident } from "@/types";

const CATEGORY_LABELS: Record<string, string> = {
  theft: "Theft",
  assault: "Assault",
  vandalism: "Vandalism",
  harassment: "Harassment",
  vehicle_breakin: "Vehicle Break-in",
  disturbance: "Disturbance",
  infrastructure: "Infrastructure",
  other: "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  police: "Police Report",
  news: "News Source",
  community: "Community Report",
};

interface IncidentCardProps {
  incident: Incident;
  onClose: () => void;
}

export function IncidentCard({ incident, onClose }: IncidentCardProps) {
  const timeAgo = getTimeAgo(incident.occurred_at);

  return (
    <div className="absolute bottom-24 left-4 right-4 z-30 max-w-sm mx-auto">
      <div className="rounded-2xl border border-white/[0.08] bg-[#12121a]/95 backdrop-blur-md p-4 shadow-xl">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                incident.verified ? "bg-red-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm font-medium text-white">
              {CATEGORY_LABELS[incident.category] || incident.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/30 hover:text-white/60 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {incident.description && (
          <p className="text-sm text-white/50 mb-3 leading-relaxed">
            {incident.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-white/30">
          <span>{timeAgo}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>{SOURCE_LABELS[incident.source] || incident.source}</span>
          {incident.verified && (
            <>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-emerald-400">Verified</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
