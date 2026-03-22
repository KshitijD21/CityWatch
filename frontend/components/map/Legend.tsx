"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const LEGEND_ITEMS = [
  { color: "#dc2626", label: "Assault" },
  { color: "#ef4444", label: "Theft / Break-in" },
  { color: "#f97316", label: "Vandalism" },
  { color: "#eab308", label: "Harassment" },
  { color: "#f59e0b", label: "Disturbance" },
  { color: "#3b82f6", label: "Infrastructure" },
  { color: "#4d7fff", label: "Your location" },
];

export function Legend() {
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
          <div className="px-3 pb-2.5 space-y-1.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: item.color, boxShadow: `0 0 4px ${item.color}40` }}
                />
                <span className="text-[11px] text-white/40">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
