"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

const MEMBERS = ["Anirudh", "Kshitij", "Ronak", "Yash"];

function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

export default function PitchPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 400),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 1800),
      setTimeout(() => setStep(4), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-dvh bg-[#08080d] flex items-center justify-center relative overflow-hidden select-none">
      {/* Background ambient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#4d7fff06_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_#7ba4ff04_0%,_transparent_60%)]" />

      <div className="relative z-10 text-center px-8">
        {/* Hackathon badge */}
        <div
          className={`transition-all duration-700 ${
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <span className="inline-block px-4 py-1.5 rounded-full border border-[#4d7fff]/20 bg-[#4d7fff]/5 text-xs text-[#7ba4ff] tracking-widest uppercase font-medium mb-8">
            Claude ASU Hackathon
          </span>
        </div>

        {/* Team name */}
        <h1
          className={`text-5xl sm:text-6xl md:text-7xl font-[family-name:var(--font-heading)] text-white leading-tight mb-4 transition-all duration-700 ${
            step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Team <span className="text-[#7ba4ff]">Rick & Morty</span>
        </h1>

        {/* Members */}
        <div
          className={`flex items-center justify-center gap-6 mt-10 mb-14 transition-all duration-700 ${
            step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {MEMBERS.map((name) => (
            <div key={name} className="flex flex-col items-center gap-2">
              <img
                src={avatarUrl(name)}
                alt={name}
                className="w-14 h-14 rounded-full border-2 border-white/[0.08]"
              />
              <span className="text-sm text-white/60 font-medium">{name}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className={`transition-all duration-700 ${
            step >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <a
            href="/pitch/scenario"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white/[0.06] border border-white/[0.1] text-base text-white/70 hover:text-white hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            Just Imagine <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
