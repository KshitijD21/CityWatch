"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Shield,
  Map,
  FileText,
  MessageCircle,
  Users,
  Bell,
  User,
  ShieldCheck,
  Radio,
  LogOut,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

const navItems = [
  { icon: Map, label: "Map", href: "/map" },
  { icon: ShieldCheck, label: "Brief", href: "/brief" },
  { icon: FileText, label: "Report", href: "/report" },
  { icon: MessageCircle, label: "Ask AI", href: "/chat" },
  { icon: Users, label: "Groups", href: "/groups" },
];

interface SidebarProps {
  incidentCount: number;
  sharing?: boolean;
  onToggleSharing?: () => void;
}

export function Sidebar({ incidentCount, sharing, onToggleSharing }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const handleLogout = () => {
    logout();
    setProfileOpen(false);
    router.push("/login");
  };

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

      {/* Location sharing toggle */}
      {onToggleSharing && (
        <div className="px-2 py-3 border-t border-white/[0.06]">
          <button
            onClick={onToggleSharing}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full cursor-pointer transition-colors ${
              sharing
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
            }`}
          >
            <Radio className={`size-[18px] shrink-0 ${sharing ? "animate-pulse" : ""}`} />
            <span className="hidden sm:block">
              {sharing ? "Sharing Live" : "Share Location"}
            </span>
          </button>
        </div>
      )}

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-white/[0.06] space-y-1">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.03] transition-colors w-full cursor-pointer">
          <Bell className="size-[18px] shrink-0" />
          <span className="hidden sm:block">Alerts</span>
        </button>

        {/* Profile with popover */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full cursor-pointer transition-colors ${
              profileOpen
                ? "bg-white/[0.06] text-white/70"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
            }`}
          >
            <User className="size-[18px] shrink-0" />
            <span className="hidden sm:block">Profile</span>
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-0 sm:left-1 mb-2 w-52 rounded-xl border border-white/[0.08] bg-[#141420] shadow-xl shadow-black/40 overflow-hidden z-50">
              {user && (
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
                  <p className="text-xs text-white/40 truncate mt-0.5">{user.email}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
