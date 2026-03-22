"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Plus,
  Copy,
  Check,
  Shield,
  Pencil,
  Trash2,
  X,
  Loader2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/api";
import type { Group, GroupMember } from "@/types";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    apiFetch("/api/groups")
      .then(async (data) => {
        const groupList = Array.isArray(data) ? data : [];
        setGroups(groupList);
        // Fetch members for each group
        const memberMap: Record<string, GroupMember[]> = {};
        await Promise.all(
          groupList.map(async (g: Group) => {
            try {
              const detail = await apiFetch(`/api/groups/${g.id}`);
              memberMap[g.id] = detail.members || [];
            } catch {
              memberMap[g.id] = [];
            }
          })
        );
        setMembers(memberMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyInvite(group: Group) {
    const link = `${window.location.origin}/join/${group.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(group.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function startRename(group: Group) {
    setEditingId(group.id);
    setEditName(group.name);
  }

  async function saveRename(groupId: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name: editName.trim() } : g))
      );
      setEditingId(null);
    } catch {
      // keep editing state so user can retry
    } finally {
      setSaving(false);
    }
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError("");
    try {
      await apiFetch(`/api/groups/join/${code}`);
      // Refresh groups list
      const data = await apiFetch("/api/groups");
      setGroups(Array.isArray(data) ? data : []);
      setShowJoin(false);
      setJoinCode("");
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Invalid invite code");
    } finally {
      setJoining(false);
    }
  }

  async function deleteGroup(groupId: string) {
    setDeletingId(groupId);
    try {
      await apiFetch(`/api/groups/${groupId}`, { method: "DELETE" });
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-dvh bg-[#08080d] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Link
            href="/map"
            className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#6c9cff]" />
            <span className="text-sm font-semibold">My Groups</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => setShowJoin(!showJoin)}
            className="text-sm text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg px-3 h-8 cursor-pointer"
          >
            <UserPlus className="size-4 mr-1" />
            Join
          </Button>
          <Link href="/onboarding">
            <Button
              variant="ghost"
              className="text-sm text-[#7ba4ff] hover:bg-white/5 rounded-lg px-3 h-8 cursor-pointer"
            >
              <Plus className="size-4 mr-1" />
              New
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Join group panel */}
        {showJoin && (
          <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white/70 mb-3">
              Enter an invite code to join a group
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. 6VRDQW"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") joinGroup();
                  if (e.key === "Escape") setShowJoin(false);
                }}
                autoFocus
                className="flex-1 bg-white/[0.03] border-white/[0.08] text-white text-sm uppercase tracking-widest focus-visible:ring-[#4d7fff]/50"
              />
              <Button
                onClick={joinGroup}
                disabled={joining || !joinCode.trim()}
                className="h-9 px-4 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm cursor-pointer disabled:opacity-50"
              >
                {joining ? <Loader2 className="size-4 animate-spin" /> : "Join"}
              </Button>
            </div>
            {joinError && (
              <p className="text-xs text-red-400 mt-2">{joinError}</p>
            )}
          </div>
        )}

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
                {editingId === group.id ? (
                  /* Rename mode */
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(group.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-white/[0.03] border-white/[0.08] text-white text-sm focus-visible:ring-[#4d7fff]/50"
                    />
                    <button
                      onClick={() => saveRename(group.id)}
                      disabled={saving || !editName.trim()}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  /* Normal mode */
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white">
                        {group.name}
                      </h3>
                      <span className="text-xs text-white/25 capitalize">
                        {group.type}
                      </span>
                    </div>

                    {/* Members */}
                    {members[group.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                        {members[group.id].map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#4d7fff]/20 flex items-center justify-center text-[10px] font-medium text-[#7ba4ff]">
                              {m.display_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="text-xs text-white/50">{m.display_name}</span>
                            {m.role === "admin" && (
                              <span className="text-[10px] text-[#7ba4ff]/60">admin</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

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

                      <button
                        onClick={() => startRename(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer"
                      >
                        <Pencil className="size-3" />
                        Rename
                      </button>

                      <button
                        onClick={() => deleteGroup(group.id)}
                        disabled={deletingId === group.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/10 bg-red-500/5 text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === group.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
