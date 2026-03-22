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
  MoreVertical,
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
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("family");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

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

  async function createGroup() {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: newGroupName.trim(), type: newGroupType }),
      });
      // Refresh groups list
      const data = await apiFetch("/api/groups");
      setGroups(Array.isArray(data) ? data : []);
      setShowCreate(false);
      setNewGroupName("");
      // Copy invite link automatically
      const link = `${window.location.origin}/join/${res.invite_code}`;
      navigator.clipboard.writeText(link);
      setCopiedId(res.group_id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
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
            onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
            className="text-sm text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg px-3 h-8 cursor-pointer"
          >
            <UserPlus className="size-4 mr-1" />
            Join
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
            className="text-sm text-[#7ba4ff] hover:bg-white/5 rounded-lg px-3 h-8 cursor-pointer"
          >
            <Plus className="size-4 mr-1" />
            New
          </Button>
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

        {/* Create group panel */}
        {showCreate && (
          <div className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white/70 mb-3">Create a new group</p>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createGroup();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                autoFocus
                className="bg-white/[0.03] border-white/[0.08] text-white text-sm focus-visible:ring-[#4d7fff]/50"
              />
              <div className="flex gap-2">
                {["family", "friends"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewGroupType(t)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm border transition-all cursor-pointer ${
                      newGroupType === t
                        ? "border-[#4d7fff]/50 bg-[#4d7fff]/10 text-[#7ba4ff]"
                        : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <Button
                onClick={createGroup}
                disabled={creating || !newGroupName.trim()}
                className="w-full h-9 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm cursor-pointer disabled:opacity-50"
              >
                {creating ? <Loader2 className="size-4 animate-spin" /> : "Create Group"}
              </Button>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
            </div>
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
            <Button
              onClick={() => setShowCreate(true)}
              className="h-9 px-5 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm cursor-pointer transition-colors"
            >
              Create a Group
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
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
                    {/* Header */}
                    <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06] mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center shrink-0">
                        <Users className="size-5 text-[#7ba4ff]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/30 capitalize px-1.5 py-0.5 rounded bg-white/[0.04]">
                            {group.type}
                          </span>
                          <span className="text-[10px] text-white/20">
                            {members[group.id]?.length || 0} members
                          </span>
                        </div>
                      </div>
                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === group.id ? null : group.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                        {menuOpenId === group.id && (
                          <div className="absolute right-0 top-8 z-10 w-32 rounded-xl border border-white/[0.08] bg-[#16161e] shadow-xl overflow-hidden">
                            <button
                              onClick={() => { startRename(group); setMenuOpenId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white/60 hover:bg-white/[0.05] transition-colors cursor-pointer"
                            >
                              <Pencil className="size-3" />
                              Rename
                            </button>
                            <button
                              onClick={() => { deleteGroup(group.id); setMenuOpenId(null); }}
                              disabled={deletingId === group.id}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400/70 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {deletingId === group.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Members with DiceBear avatars */}
                    {members[group.id]?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {members[group.id].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              if (m.user_id) {
                                router.push(`/map?focus=${m.user_id}`);
                              }
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] transition-colors cursor-pointer"
                          >
                            <img
                              src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(m.display_name || "?")}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                              alt={m.display_name}
                              className="w-6 h-6 rounded-full"
                            />
                            <span className="text-xs text-white/60">{m.display_name}</span>
                            {m.role === "admin" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#4d7fff]/10 text-[#7ba4ff]">admin</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Invite link */}
                    <div className="flex items-center gap-2 pt-4 border-t border-white/[0.06]">
                      <div className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-[10px] text-white/20 truncate">
                          {typeof window !== "undefined" ? `${window.location.origin}/join/${group.invite_code}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => copyInvite(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedId === group.id ? (
                          <>
                            <Check className="size-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            Copy
                          </>
                        )}
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
