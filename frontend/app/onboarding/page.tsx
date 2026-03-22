"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { EthicsStep } from "@/components/onboarding/EthicsStep";
import { CreateGroupStep } from "@/components/onboarding/CreateGroupStep";
import { AddMembersStep } from "@/components/onboarding/AddMembersStep";
import { AddPlacesStep } from "@/components/onboarding/AddPlacesStep";
import { useAuthContext } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

const TOTAL_STEPS = 4;

const STEP_LABELS = [
  "Welcome",
  "Create Group",
  "Invite Members",
  "Add Places",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuthContext();
  const [step, setStep] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Redirect to signup if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/signup");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  async function next() {
    if (step >= TOTAL_STEPS - 1) {
      try {
        await apiFetch("/api/auth/me/onboarded", { method: "PUT" });
      } catch {}
      router.push("/map");
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  return (
    <div className="min-h-dvh bg-[#08080d] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Shield className="size-5 text-[#6c9cff]" />
            <span className="text-base font-semibold tracking-tight text-white/90">
              CityWatch
            </span>
          </div>
          {step > 0 && (
            <button
              onClick={back}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">{STEP_LABELS[step]}</span>
            <span className="text-xs text-white/20">
              {step + 1} of {TOTAL_STEPS}
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  i <= step ? "bg-[#4d7fff]" : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          {step === 0 && <EthicsStep onContinue={next} />}
          {step === 1 && (
            <CreateGroupStep
              onContinue={(id, name, code) => {
                setGroupId(id);
                setGroupName(name);
                setInviteCode(code);
                next();
              }}
            />
          )}
          {step === 2 && (
            <AddMembersStep
              groupId={groupId}
              groupName={groupName}
              inviteCode={inviteCode}
              onContinue={next}
            />
          )}
          {step === 3 && <AddPlacesStep onContinue={next} />}
        </div>
      </div>
    </div>
  );
}
