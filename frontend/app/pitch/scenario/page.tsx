"use client";

import { useEffect, useState } from "react";

export default function ScenarioPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2500),
      setTimeout(() => setStep(3), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="h-dvh bg-[#08080d] flex items-center justify-center relative overflow-hidden select-none">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#4d7fff08_0%,_transparent_70%)]" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-500/[0.03] rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-[#4d7fff]/[0.04] rounded-full blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-8 text-center">
        {/* Phone mockup with alerts */}
        <div
          className={`transition-all duration-1000 ${
            step >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="mx-auto w-64 mb-12">
            {/* Phone frame */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f18] p-4 space-y-3 shadow-2xl shadow-black/50">
              {/* Citizen-style alert */}
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Alert</span>
                </div>
                <p className="text-xs text-red-300/80">Shots reported nearby</p>
                <p className="text-[9px] text-red-400/40 mt-1">2 min ago · 0.3 mi away</p>
              </div>

              {/* Text messages */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-end">
                  <div className="bg-[#4d7fff] rounded-xl rounded-br-sm px-3 py-1.5 max-w-[80%]">
                    <p className="text-[10px] text-white">You home yet?</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#4d7fff] rounded-xl rounded-br-sm px-3 py-1.5 max-w-[80%]">
                    <p className="text-[10px] text-white">Hello??</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/[0.06] rounded-xl rounded-bl-sm px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line 1 */}
        <p
          className={`text-2xl sm:text-3xl md:text-4xl font-[family-name:var(--font-heading)] text-white/90 leading-tight transition-all duration-1000 ${
            step >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          It&apos;s 10 PM. You&apos;ve texted twice.
          <br />
          <span className="text-white/40">No reply.</span>
        </p>

        {/* Line 2 */}
        <p
          className={`mt-6 text-lg sm:text-xl text-white/50 font-light transition-all duration-1000 ${
            step >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Then your phone screams <span className="text-red-400/80">fear</span>, not <span className="text-[#7ba4ff]">facts</span>.
        </p>

        {/* Navigate to problem statement */}
        {step >= 3 && (
          <a
            href="/pitch/problem"
            className="inline-flex items-center gap-2 mt-12 px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.1] transition-all cursor-pointer animate-pulse"
          >
            What did we understand? →
          </a>
        )}
      </div>
    </div>
  );
}
