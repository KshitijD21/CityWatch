"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Map,
  FileText,
  MessageCircle,
  Users,
  Bell,
  User,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { icon: Map, label: "Map", href: "/map" },
  { icon: ShieldCheck, label: "Brief", href: "/brief" },
  { icon: FileText, label: "Report", href: "/report" },
  { icon: MessageCircle, label: "Ask AI", href: "/chat" },
  { icon: Users, label: "Groups", href: "/groups" },
];

interface SidebarProps {
  incidentCount: number;
}

export function Sidebar({ incidentCount }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-16 sm:w-60 h-full flex flex-col border-r border-white/[0.06] bg-[#0c0c14] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/[0.06]">
        <Shield className="size-5 text-[#6c9cff] shrink-0" />
        <span className="text-sm font-semibold tracking-tight text-white/90 hidden sm:block">
          CityWatch
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? "bg-[#4d7fff]/10 text-[#7ba4ff]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className="size-[18px] shrink-0" />
              <span className="hidden sm:block">{item.label}</span>
              {item.label === "Map" && incidentCount > 0 && (
                <span className="hidden sm:inline-flex ml-auto text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                  {incidentCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-white/[0.06] space-y-1">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors w-full cursor-pointer">
          <Bell className="size-[18px] shrink-0" />
          <span className="hidden sm:block">Alerts</span>
        </button>
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors w-full cursor-pointer">
          <User className="size-[18px] shrink-0" />
          <span className="hidden sm:block">Profile</span>
        </button>
      </div>
    </div>
  );
}
