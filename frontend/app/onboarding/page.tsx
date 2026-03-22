"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { EthicsStep } from "@/components/onboarding/EthicsStep";
import { CreateGroupStep } from "@/components/onboarding/CreateGroupStep";
import { AddMembersStep } from "@/components/onboarding/AddMembersStep";
import { AddPlacesStep } from "@/components/onboarding/AddPlacesStep";

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");

  function next() {
    if (step >= TOTAL_STEPS - 1) {
      router.push("/map");
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="min-h-dvh bg-[#08080d] flex flex-col items-center px-6 py-8">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <Shield className="size-5 text-[#6c9cff]" />
        <span className="text-base font-semibold tracking-tight text-white/90">
          CityWatch
        </span>
      </div>

      {/* Progress bar */}
      {step > 0 && (
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/30">
              Step {step} of {TOTAL_STEPS - 1}
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4d7fff] rounded-full transition-all duration-500"
              style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="w-full max-w-md">
        {step === 0 && <EthicsStep onContinue={next} />}
        {step === 1 && (
          <CreateGroupStep
            onContinue={(id, name) => {
              setGroupId(id);
              setGroupName(name);
              next();
            }}
          />
        )}
        {step === 2 && (
          <AddMembersStep
            groupId={groupId}
            groupName={groupName}
            onContinue={next}
          />
        )}
        {step === 3 && <AddPlacesStep onContinue={next} />}
      </div>
    </div>
  );
}
