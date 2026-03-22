"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Newspaper, Users, X, ArrowRight, Map } from "lucide-react";

const PROBLEMS = [
  {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    title: "Citizen amplifies fear",
    description: "Wrong alerts, no context. A car backfiring becomes \"shots fired.\" Panic, not facts.",
  },
  {
    icon: Newspaper,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Crime maps are static",
    description: "Impersonal data dumps, days old. No real-time awareness, no personalization.",
  },
  {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Nextdoor is unverified paranoia",
    description: "Neighbors calling people \"suspicious\" with zero evidence. Fear spreads faster than facts.",
  },
  {
    icon: X,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    title: "Parents text into the void",
    description: "\"Are you home yet?\" sent twice. No reply. No way to know if their kid's route is safe.",
  },
];

export default function ProblemPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1200),
      setTimeout(() => setStep(3), 1900),
      setTimeout(() => setStep(4), 2600),
      setTimeout(() => setStep(5), 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-dvh bg-[#08080d] flex items-center justify-center relative overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#ff444408_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#4d7fff06_0%,_transparent_60%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-8">
        {/* Title */}
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="text-xs text-red-400/60 uppercase tracking-[0.2em] font-medium mb-3">
            The Problem
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-[family-name:var(--font-heading)] text-white leading-tight">
            Families have no good tool
            <br />
            <span className="text-white/30">for safety</span>
          </h1>
        </div>

        {/* Problem cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROBLEMS.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <div
                key={problem.title}
                className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-700 ${
                  step >= i + 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${problem.bg} flex items-center justify-center mb-4`}>
                  <Icon className={`size-5 ${problem.color}`} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">
                  {problem.title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div
          className={`text-center mt-10 transition-all duration-700 ${
            step >= 5 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <p className="text-sm text-white/30 mb-4">
            We set out to build the opposite: <span className="text-white/60">a tool that informs, not frightens.</span>
          </p>
          <a
            href="/pitch/solution"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#4d7fff]/10 border border-[#4d7fff]/20 text-sm text-[#7ba4ff] hover:bg-[#4d7fff]/20 transition-all cursor-pointer"
          >
            Our Solution <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
