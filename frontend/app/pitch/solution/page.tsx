"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Map,
  Users,
  MessageCircle,
  ShieldCheck,
  Radio,
  FileText,
  Bell,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: Map,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Live Safety Map",
    description: "Real-time incidents from police, news, and community,all on one map with smart filters.",
  },
  {
    icon: Users,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Family Circles",
    description: "Share locations, see who's nearby, get alerts when someone enters a flagged area.",
  },
  {
    icon: MessageCircle,
    color: "text-[#7ba4ff]",
    bg: "bg-[#4d7fff]/10",
    title: "AI Safety Assistant",
    description: "\"Is it safe near campus at 11pm?\" Ask anything, get real answers backed by data.",
  },
  {
    icon: ShieldCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Smart Briefs",
    description: "AI-generated safety summaries. Time-of-day breakdown, trends, incident categories.",
  },
  {
    icon: FileText,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Community Reporting",
    description: "Report incidents with photos. AI verifies against official data. Community trust layer.",
  },
  {
    icon: Bell,
    color: "text-red-400",
    bg: "bg-red-500/10",
    title: "Proximity Alerts",
    description: "Get notified when incidents happen near your saved places,home, work, campus.",
  },
];

export default function SolutionPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 1400),
      setTimeout(() => setStep(4), 1800),
      setTimeout(() => setStep(5), 2200),
      setTimeout(() => setStep(6), 2600),
      setTimeout(() => setStep(7), 3000),
      setTimeout(() => setStep(8), 3800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-dvh bg-[#08080d] flex items-center justify-center relative overflow-hidden select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#4d7fff08_0%,_transparent_60%)]" />

      <div className="relative z-10 max-w-5xl mx-auto px-8">
        {/* Title */}
        <div
          className={`text-center mb-10 transition-all duration-700 ${
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="size-8 text-[#6c9cff]" />
            <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              CityWatch
            </span>
          </div>
          <p className="text-lg sm:text-xl text-white/70 font-light">
            A tool that informs, not frightens.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-700 hover:bg-white/[0.04] hover:border-white/[0.1] ${
                  step >= i + 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl ${feature.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`size-[18px] ${feature.color}`} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tech stack + Demo CTA */}
        <div
          className={`text-center mt-10 transition-all duration-700 ${
            step >= 8 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex items-center justify-center gap-3 text-[10px] text-white/25 uppercase tracking-widest mb-5">
            <span>Next.js</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>FastAPI</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>Claude AI</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>Mapbox</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>InsForge</span>
          </div>
          <a
            href="https://city-watch-frontend.vercel.app/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#4d7fff] text-sm font-medium text-white hover:bg-[#5a88ff] transition-all cursor-pointer shadow-lg shadow-[#4d7fff]/25"
          >
            Live Demo <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
