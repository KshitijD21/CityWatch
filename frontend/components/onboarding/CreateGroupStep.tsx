"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

const GROUP_TYPES = [
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
];

interface CreateGroupStepProps {
  onContinue: (groupId: string, groupName: string, inviteCode: string) => void;
}

export function CreateGroupStep({ onContinue }: CreateGroupStepProps) {
  const [name, setName] = useState("My Family");
  const [type, setType] = useState("family");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), type }),
      });
      onContinue(res.group_id, name.trim(), res.invite_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center">
          <Users className="size-5 text-[#7ba4ff]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Who are you staying safe with?</h2>
          <p className="text-xs text-white/40">Create your first group</p>
        </div>
      </div>

      <div className="space-y-5 mt-6">
        <Input
          label="Group name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus-visible:ring-[#4d7fff]/50"
        />

        <div>
          <label className="text-sm font-medium text-white/70 block mb-2.5">
            Group type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GROUP_TYPES.map((gt) => (
              <button
                key={gt.value}
                onClick={() => setType(gt.value)}
                className={`px-3 py-2.5 rounded-xl text-sm border transition-all cursor-pointer ${
                  type === gt.value
                    ? "border-[#4d7fff]/50 bg-[#4d7fff]/10 text-[#7ba4ff]"
                    : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                }`}
              >
                {gt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
          className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
        </Button>
      </div>
    </div>
  );
}
