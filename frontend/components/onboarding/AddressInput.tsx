"use client";

import { useState, useRef, useEffect } from "react";

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface Suggestion {
  display_name: string;
  place_id: number;
}

export function AddressInput({ value, onChange, placeholder }: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(text: string) {
    onChange(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=0`
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function select(suggestion: Suggestion) {
    const short = suggestion.display_name.split(",").slice(0, 3).join(",").trim();
    onChange(short);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-sm text-white placeholder:text-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d7fff]/50 transition-colors"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-white/[0.08] bg-[#12121a] shadow-xl overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => select(s)}
              className="w-full text-left px-3 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer border-b border-white/[0.04] last:border-0"
            >
              {s.display_name.length > 80
                ? s.display_name.slice(0, 80) + "..."
                : s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
