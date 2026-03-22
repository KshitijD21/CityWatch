"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { UserPlus, Copy, Check, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const ROLES = ["Adult", "Teen", "Child"];

interface Member {
  name: string;
  role: string;
}

interface AddMembersStepProps {
  groupId: string | null;
  groupName: string;
  onContinue: () => void;
}

export function AddMembersStep({ groupId, groupName, onContinue }: AddMembersStepProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Adult");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function addMember() {
    if (!newName.trim() || !groupId) return;
    setLoading(true);

    try {
      await apiFetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), role: newRole.toLowerCase() }),
      });
      setMembers([...members, { name: newName.trim(), role: newRole }]);
      setNewName("");
    } catch {
      // silently fail for hackathon
    } finally {
      setLoading(false);
    }
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/join/${groupId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center">
          <UserPlus className="size-5 text-[#7ba4ff]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Add people to &ldquo;{groupName}&rdquo;</h2>
          <p className="text-xs text-white/40">You can always add more later</p>
        </div>
      </div>

      {/* Members list */}
      {members.length > 0 && (
        <div className="mt-4 space-y-2 mb-5">
          {members.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="text-sm text-white/80">{m.name}</span>
              <span className="text-xs text-white/30">{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add member form */}
      <div className="space-y-3 mt-5">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:ring-[#4d7fff]/50"
            />
          </div>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-white/70 outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="bg-[#08080d]">
                {r}
              </option>
            ))}
          </select>
        </div>

        <Button
          onClick={addMember}
          disabled={loading || !newName.trim()}
          variant="outline"
          className="w-full h-9 bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Add Member"}
        </Button>
      </div>

      {/* Invite link */}
      <button
        onClick={copyInviteLink}
        className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm text-white/40 hover:text-white/60 transition-colors cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="size-3.5" />
            Share invite link
          </>
        )}
      </button>

      {/* Continue */}
      <Button
        onClick={onContinue}
        className="w-full h-10 mt-6 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors"
      >
        Continue
      </Button>
    </div>
  );
}
