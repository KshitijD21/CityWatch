"use client";

import Link from "next/link";
import { Shield, Bell, MessageCircle, User } from "lucide-react";

export function TopBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 bg-[#08080d]/90 backdrop-blur-md border-b border-white/[0.06]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-[#6c9cff]" />
          <span className="text-sm font-semibold text-white/90">CityWatch</span>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
            <Bell className="size-5" />
          </button>
          <Link
            href="/chat"
            className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <MessageCircle className="size-5" />
          </Link>
          <button className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
            <User className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
