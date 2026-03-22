"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Plus, Copy, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { Group } from "@/types";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/groups")
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyInvite(group: Group) {
    const link = `${window.location.origin}/join/${group.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-dvh bg-[#08080d] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link href="/map" className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#6c9cff]" />
            <span className="text-sm font-semibold">My Groups</span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="text-sm text-[#7ba4ff] hover:bg-white/5 rounded-lg px-3 h-8 cursor-pointer"
        >
          <Plus className="size-4 mr-1" />
          New
        </Button>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-[#4d7fff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="size-10 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-sm mb-2">No groups yet</p>
            <p className="text-white/25 text-xs mb-6">
              Create a group to start coordinating with your people.
            </p>
            <Link href="/onboarding">
              <Button className="h-9 px-5 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm cursor-pointer transition-colors">
                Create a Group
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                  <span className="text-xs text-white/25 capitalize">{group.type}</span>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => copyInvite(group)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    {copiedId === group.id ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        Invite link
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
