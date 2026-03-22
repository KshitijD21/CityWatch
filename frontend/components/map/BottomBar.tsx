"use client";

import Link from "next/link";
import { MapPin, FileText, MessageCircle, Shield } from "lucide-react";

const actions = [
  { icon: Shield, label: "Brief", href: "/brief" },
  { icon: FileText, label: "Report", href: "/report" },
  { icon: MessageCircle, label: "Ask AI", href: "/chat" },
  { icon: MapPin, label: "Places", href: "/groups" },
];

export function BottomBar() {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#08080d]/90 backdrop-blur-md border-t border-white/[0.06]">
      <div className="flex items-center justify-around px-4 py-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-[#7ba4ff] transition-colors"
          >
            <action.icon className="size-5" />
            <span className="text-[10px] font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
