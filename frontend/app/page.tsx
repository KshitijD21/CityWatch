"use client";

import Link from "next/link";
import { Globe } from "@/components/landing/Globe";
import { LiveChip } from "@/components/landing/LiveChip";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#08080d]">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-10 sm:px-16 lg:px-24 py-4">
        <div className="flex items-center gap-2.5">
          <Shield className="size-5 text-[#6c9cff]" />
          <span className="text-base font-semibold tracking-tight text-white/90">
            CityWatch
          </span>
        </div>

        <nav className="hidden sm:flex items-center gap-8">
          <a href="#features" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            How it works
          </a>
          <a href="#safety" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            Safety
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              className="text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full px-4 h-9 cursor-pointer transition-colors"
            >
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="text-sm bg-white/10 text-white hover:bg-white/15 rounded-full px-4 h-9 cursor-pointer transition-colors border border-white/10">
              Sign up
            </Button>
          </Link>
        </div>
      </header>

      {/* Text content — upper portion */}
      <main className="relative z-10 flex flex-col items-center pt-[6vh] sm:pt-[10vh] px-6">
        <div className="max-w-3xl text-center">
          <LiveChip />
          <h1 className="text-3xl tracking-[-0.01em] text-white sm:text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.15] font-[family-name:var(--font-heading)]">
            Safety intelligence for the
            <br />
            people you{" "}
            <span className="text-[#7ba4ff] font-[family-name:var(--font-accent)] italic">love.</span>
          </h1>
          <p className="mt-5 text-base text-white/40 sm:text-lg max-w-lg mx-auto font-light tracking-[-0.01em] leading-relaxed">
            Real-time insights, trusted circles, and an AI assistant that tells
            you what you need to know, without the noise or fear.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/signup">
              <Button
                size="lg"
                className="h-11 px-7 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-full text-sm font-medium cursor-pointer transition-colors"
              >
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="ghost"
                size="lg"
                className="h-11 px-7 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-full text-sm cursor-pointer transition-colors"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Globe — pushed further down, only top peeking */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[55%] w-[min(950px,110vw)] aspect-square">
        <Globe />
      </div>
    </div>
  );
}
