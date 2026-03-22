"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  { text: "incidents tracked today", base: 1247 },
  { text: "safety alerts sent", base: 892 },
  { text: "areas monitored live", base: 3400 },
];

export function LiveChip() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [count, setCount] = useState(MESSAGES[0].base);
  const [fading, setFading] = useState(false);

  // Tick the counter up every few seconds
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 2000 + Math.random() * 2000);

    return () => clearInterval(tickInterval);
  }, [msgIndex]);

  // Rotate messages every 5 seconds
  useEffect(() => {
    const rotateInterval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setMsgIndex((i) => {
          const next = (i + 1) % MESSAGES.length;
          setCount(MESSAGES[next].base + Math.floor(Math.random() * 50));
          return next;
        });
        setFading(false);
      }, 300);
    }, 5000);

    return () => clearInterval(rotateInterval);
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 mb-6 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Pulsing live dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>

      <span className="text-xs text-white/60 font-medium tracking-wide">
        <span className="text-white/90 font-semibold tabular-nums">
          {count.toLocaleString()}
        </span>{" "}
        {MESSAGES[msgIndex].text}
      </span>
    </div>
  );
}
