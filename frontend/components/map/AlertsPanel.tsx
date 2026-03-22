"use client";

import { useState, useEffect } from "react";
import {
  X,
  Bell,
  MapPin,
  Clock,
  Shield,
  Eye,
  ShieldAlert,
  Wrench,
  Megaphone,
  Car,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Alert {
  id: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  occurred_at: string;
  source: string;
  verified: boolean;
  distance_miles: number;
  near: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  theft: { icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10" },
  assault: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
  vandalism: { icon: Wrench, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  harassment: { icon: Megaphone, color: "text-pink-400", bg: "bg-pink-500/10" },
  vehicle_breakin: { icon: Car, color: "text-amber-400", bg: "bg-amber-500/10" },
  disturbance: { icon: AlertTriangle, color: "text-purple-400", bg: "bg-purple-500/10" },
  infrastructure: { icon: Wrench, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  other: { icon: Shield, color: "text-white/50", bg: "bg-white/5" },
};

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

interface AlertsPanelProps {
  onClose: () => void;
}

export function AlertsPanel({ onClose }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function fetchAlerts() {
      apiFetch("/api/alerts?radius=2&hours=12")
        .then((data) => setAlerts(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute bottom-14 left-1 z-40 w-72 rounded-xl border border-white/[0.08] bg-[#12121a]/95 backdrop-blur-md shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Bell className="size-3.5 text-[#7ba4ff]" />
          <span className="text-xs font-semibold text-white">Alerts</span>
          {alerts.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Alerts list */}
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-white/[0.06] rounded mb-2" />
                  <div className="h-2.5 w-full bg-white/[0.04] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Bell className="size-8 text-white/10 mb-3" />
            <p className="text-sm text-white/30">No recent alerts</p>
            <p className="text-xs text-white/15 mt-1">
              Incidents near your places will show here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {alerts.map((alert) => {
              const cfg = CATEGORY_CONFIG[alert.category] || CATEGORY_CONFIG.other;
              const Icon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`size-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/80 capitalize">
                        {alert.category.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-white/25">
                        {timeAgo(alert.occurred_at)}
                      </span>
                    </div>
                    {alert.description && (
                      <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">
                        {alert.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/25 flex items-center gap-0.5">
                        <MapPin className="size-2.5" />
                        {alert.distance_miles.toFixed(1)} mi from {alert.near}
                      </span>
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

// Hook to get alert count for badge
export function useAlertCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    function fetchCount() {
      apiFetch("/api/alerts?radius=2&hours=6")
        .then((data) => setCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {});
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
