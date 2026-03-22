"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Radio, Newspaper, Users } from "lucide-react";

const LEGEND_ITEMS = [
  { color: "#dc2626", label: "Assault" },
  { color: "#ef4444", label: "Theft / Break-in" },
  { color: "#f97316", label: "Vandalism" },
  { color: "#eab308", label: "Harassment" },
  { color: "#f59e0b", label: "Disturbance" },
  { color: "#3b82f6", label: "Infrastructure" },
  { color: "#4d7fff", label: "Your location" },
];

const SOURCE_FILTERS = [
  { key: "police", label: "Police", icon: Radio, color: "text-blue-400", bg: "bg-blue-500/10" },
  { key: "news", label: "News", icon: Newspaper, color: "text-amber-400", bg: "bg-amber-500/10" },
  { key: "community", label: "Community", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
] as const;

interface LegendProps {
  sourceFilters?: Record<string, boolean>;
  onToggleSource?: (source: string) => void;
}

export function Legend({ sourceFilters, onToggleSource }: LegendProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute top-4 right-4 z-20">
      <div className="rounded-xl border border-white/[0.08] bg-[#12121a]/90 backdrop-blur-md shadow-lg overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors cursor-pointer"
        >
          Legend
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>

        {open && (
          <div className="px-3 pb-2.5">
            {/* Source filters */}
            {onToggleSource && (
              <div className="flex gap-1 mb-2.5 pb-2.5 border-b border-white/[0.06]">
                {SOURCE_FILTERS.map((src) => {
                  const active = sourceFilters?.[src.key] !== false;
                  const Icon = src.icon;
                  return (
                    <button
                      key={src.key}
                      onClick={() => onToggleSource(src.key)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                        active
                          ? `${src.bg} ${src.color} border border-current/20`
                          : "bg-white/[0.03] text-white/20 border border-white/[0.04] line-through"
                      }`}
                    >
                      <Icon className="size-2.5" />
                      {src.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Category legend */}
            <div className="space-y-1.5">
              {LEGEND_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: item.color, boxShadow: `0 0 4px ${item.color}40` }}
                  />
                  <span className="text-[11px] text-white/40">{item.label}</span>
                </div>
              ))}
              {/* Community diamond indicator */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 shrink-0 bg-white/40 rotate-45"
                  style={{ boxShadow: "0 0 4px rgba(255,255,255,0.2)" }}
                />
                <span className="text-[11px] text-white/40">Community report</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
