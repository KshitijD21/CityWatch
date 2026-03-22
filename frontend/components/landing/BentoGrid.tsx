"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Map, Users, Brain, MessageCircle } from "lucide-react";
import { FadeIn } from "./FadeIn";

const features = [
  {
    icon: Map,
    title: "Live Safety Map",
    description:
      "Real-time incidents from police, news, and community, all on one map. See what's happening before you head out.",
    className: "md:col-span-2",
  },
  {
    icon: Users,
    title: "Family Circles",
    description:
      "Know where your people are. Get alerts when someone enters a flagged area.",
    className: "md:col-span-1",
  },
  {
    icon: MessageCircle,
    title: "AI Assistant",
    description:
      '"Is it safe to walk near campus at 11pm?" Ask anything, get real answers with sources.',
    className: "md:col-span-1",
  },
  {
    icon: Brain,
    title: "Smart Briefs",
    description:
      "AI-generated safety summaries for any area. Time-of-day breakdown, trends, and what to watch for.",
    className: "md:col-span-2",
  },
];

export function BentoGrid() {
  return (
    <section id="features" className="px-6 sm:px-16 lg:px-24 py-24 sm:py-28">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <FadeIn className="text-center mb-14">
          <p className="text-xs font-medium text-[#7ba4ff] tracking-widest uppercase mb-3">
            Built for families
          </p>
          <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-heading)] text-white leading-tight">
            Everything you need to{" "}
            <span className="text-[#7ba4ff] font-[family-name:var(--font-accent)] italic">stay aware</span>
          </h2>
        </FadeIn>

        {/* 2x2 bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {features.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 100} className={feature.className}>
              <div className="group relative h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-7 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.1]">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/50 group-hover:text-[#7ba4ff] transition-colors mb-3">
                  <feature.icon className="size-[18px]" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white/90 mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* How it works */}
        <div id="how-it-works" className="mt-32">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-medium text-[#7ba4ff] tracking-widest uppercase mb-3">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl font-[family-name:var(--font-heading)] text-white leading-tight">
              Three steps to{" "}
              <span className="text-[#7ba4ff] font-[family-name:var(--font-accent)] italic">peace of mind</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Create your circle",
                description:
                  "Sign up and invite the people who matter most. Family, roommates, close friends.",
              },
              {
                step: "02",
                title: "Save your places",
                description:
                  "Add home, work, campus, anywhere you frequent. We'll keep watch on those areas.",
              },
              {
                step: "03",
                title: "Stay informed",
                description:
                  "Get AI-powered briefs, real-time alerts, and ask questions about any location.",
              },
            ].map((item, i) => (
              <FadeIn key={item.step} delay={i * 150} className="text-center md:text-left">
                <div className="text-3xl font-bold text-[#4d7fff]/50 mb-3 font-[family-name:var(--font-heading)]">
                  {item.step}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-white/60 font-light leading-relaxed">
                  {item.description}
                </p>
              </FadeIn>
            ))}
          </div>
        </div>

        {/* CTA banner */}
        <FadeIn className="mt-32" delay={0}>
          <div id="safety" className="relative rounded-2xl border border-white/[0.08] p-10 sm:p-16 text-center overflow-hidden bg-gradient-to-br from-[#0f1628] via-[#111827] to-[#0c1220]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#4d7fff15_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_left,_#7ba4ff10_0%,_transparent_50%)] pointer-events-none" />
            <h2 className="relative text-2xl sm:text-3xl font-[family-name:var(--font-heading)] text-white mb-4">
              Safety shouldn&apos;t require fear
            </h2>
            <p className="relative text-white/60 max-w-md mx-auto mb-8 text-sm sm:text-base font-light leading-relaxed">
              CityWatch is built on a simple belief: awareness is empowering, not
              alarming. Know more, worry less.
            </p>
            <Link href="/signup" className="relative">
              <Button className="h-11 px-7 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-full text-sm font-medium cursor-pointer transition-colors">
                Get started for free
              </Button>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
