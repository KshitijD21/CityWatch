"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, Copy, Check, Share2 } from "lucide-react";

interface AddMembersStepProps {
  groupId: string | null;
  groupName: string;
  inviteCode: string | null;
  onContinue: () => void;
}

export function AddMembersStep({ groupId, groupName, inviteCode, onContinue }: AddMembersStepProps) {
  const [copied, setCopied] = useState(false);

  const inviteLink = typeof window !== "undefined"
    ? `${window.location.origin}/join/${inviteCode || groupId}`
    : "";

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInviteLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join "${groupName}" on CityWatch`,
          text: `Join my safety group "${groupName}" on CityWatch`,
          url: inviteLink,
        });
      } catch {
        // User cancelled or share failed — fall back to copy
        copyInviteLink();
      }
    } else {
      copyInviteLink();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#4d7fff]/10 flex items-center justify-center">
          <UserPlus className="size-5 text-[#7ba4ff]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Invite people to &ldquo;{groupName}&rdquo;</h2>
          <p className="text-xs text-white/40">Share this link so others can join your group</p>
        </div>
      </div>

      {/* Invite code display */}
      <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 text-center">
        <p className="text-xs text-white/30 mb-2">Invite code</p>
        <p className="text-2xl font-mono font-bold tracking-[0.3em] text-[#7ba4ff]">
          {inviteCode || "------"}
        </p>
      </div>

      {/* Invite link */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-white/30 mb-1.5">Invite link</p>
        <p className="text-sm text-white/60 break-all">{inviteLink}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={copyInviteLink}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-white/50 hover:text-white/70 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="size-4 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-4" />
              Copy link
            </>
          )}
        </button>
        <button
          onClick={shareInviteLink}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-[#4d7fff]/30 bg-[#4d7fff]/10 text-sm text-[#7ba4ff] hover:bg-[#4d7fff]/20 transition-colors cursor-pointer"
        >
          <Share2 className="size-4" />
          Share
        </button>
      </div>

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
