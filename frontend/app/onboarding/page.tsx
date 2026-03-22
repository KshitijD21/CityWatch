"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, MapPin, Users, ShieldCheck } from "lucide-react";
import { EthicsStep } from "@/components/onboarding/EthicsStep";
import { CreateGroupStep } from "@/components/onboarding/CreateGroupStep";
import { AddMembersStep } from "@/components/onboarding/AddMembersStep";
import { AddPlacesStep } from "@/components/onboarding/AddPlacesStep";

const TOTAL_STEPS = 4;

const STEP_VISUALS = [
  {
    icon: ShieldCheck,
    title: "Built on trust",
    subtitle: "We believe safety awareness should empower, not alarm.",
    accent: "from-amber-500/10 to-orange-500/10",
  },
  {
    icon: Users,
    title: "Stronger together",
    subtitle: "Create a circle with the people who matter most to you.",
    accent: "from-[#4d7fff]/10 to-indigo-500/10",
  },
  {
    icon: Users,
    title: "Your people, connected",
    subtitle: "Share locations, coordinate plans, and stay in sync.",
    accent: "from-emerald-500/10 to-teal-500/10",
  },
  {
    icon: MapPin,
    title: "Your places, watched",
    subtitle: "We'll keep an eye on the areas you care about most.",
    accent: "from-purple-500/10 to-pink-500/10",
  },
];

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

  const visual = STEP_VISUALS[step];

  return (
    <div className="h-dvh bg-[#08080d] flex">
      {/* Left — visual side (hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden border-r border-white/[0.04]">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${visual.accent} transition-all duration-700`}
        />
        <div className="relative text-center px-16 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mx-auto mb-6">
            <visual.icon className="size-7 text-white/40" />
          </div>
          <h2 className="text-2xl font-[family-name:var(--font-heading)] text-white/80 mb-3">
            {visual.title}
          </h2>
          <p className="text-sm text-white/30 leading-relaxed">
            {visual.subtitle}
          </p>
          <div className="flex items-center justify-center gap-2 mt-10">
            {STEP_VISUALS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === step
                    ? "w-6 bg-[#4d7fff]"
                    : i < step
                    ? "w-1.5 bg-white/20"
                    : "w-1.5 bg-white/[0.06]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right — form side */}
      <div className="w-full lg:w-1/2 flex flex-col px-6 sm:px-12 lg:px-16 py-8 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <Shield className="size-5 text-[#6c9cff]" />
          <span className="text-base font-semibold tracking-tight text-white/90">
            CityWatch
          </span>
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="max-w-md mb-8">
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
        <div className="flex-1 flex items-center justify-center">
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
      </div>

    </div>
  );
}
