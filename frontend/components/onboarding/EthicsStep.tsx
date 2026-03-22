"use client";

import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, Check, X } from "lucide-react";

const weDo = [
  "Summarize public incident reports",
  "Highlight community safety signals",
  "Explain the data behind every alert",
];

const weDont = [
  'Predict where crime "will" happen',
  'Label neighborhoods "safe" or "dangerous"',
  "Replace your judgment",
  "Share location without consent",
];

interface EthicsStepProps {
  onContinue: () => void;
}

export function EthicsStep({ onContinue }: EthicsStepProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle className="size-5 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Before you start</h2>
      </div>

      <p className="text-sm text-white/50 leading-relaxed mb-6">
        CityWatch is not a crime predictor. We show you what&apos;s been
        reported — you make your own choices.
      </p>

      <div className="space-y-5 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <ShieldCheck className="size-4 text-emerald-400" />
            <span className="text-sm font-medium text-white/70">What we do</span>
          </div>
          <ul className="space-y-2">
            {weDo.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/40">
                <Check className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <X className="size-4 text-red-400" />
            <span className="text-sm font-medium text-white/70">What we don&apos;t do</span>
          </div>
          <ul className="space-y-2">
            {weDont.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/40">
                <X className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Button
        onClick={onContinue}
        className="w-full h-10 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer transition-colors"
      >
        I Understand
      </Button>
    </div>
  );
}
