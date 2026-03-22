"use client";

import { useState, type FormEvent } from "react";
import { X, Loader2, CheckCircle, Camera, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { insforge } from "@/lib/insforge";

const CATEGORIES = [
  "theft", "assault", "vandalism", "harassment",
  "vehicle_breakin", "disturbance", "infrastructure", "other",
];

const CATEGORY_DATA: Record<string, { label: string; emoji: string; color: string }> = {
  theft: { label: "Theft", emoji: "🔓", color: "border-red-500/30 bg-red-500/5 text-red-300" },
  assault: { label: "Assault", emoji: "🚨", color: "border-rose-500/30 bg-rose-500/5 text-rose-300" },
  vandalism: { label: "Vandalism", emoji: "🔨", color: "border-orange-500/30 bg-orange-500/5 text-orange-300" },
  harassment: { label: "Harassment", emoji: "⚠️", color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300" },
  vehicle_breakin: { label: "Vehicle Break-in", emoji: "🚗", color: "border-red-400/30 bg-red-400/5 text-red-300" },
  disturbance: { label: "Disturbance", emoji: "📢", color: "border-amber-500/30 bg-amber-500/5 text-amber-300" },
  infrastructure: { label: "Infrastructure", emoji: "🚧", color: "border-blue-500/30 bg-blue-500/5 text-blue-300" },
  other: { label: "Other", emoji: "📌", color: "border-gray-500/30 bg-gray-500/5 text-gray-300" },
};

interface ReportModalProps {
  userLocation: { lat: number; lng: number };
  onClose: () => void;
  onSubmitted: () => void;
}

export function ReportModal({ userLocation, onClose, onSubmitted }: ReportModalProps) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [address, setAddress] = useState("Using your current location");

  // Reverse geocode on mount
  useState(() => {
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`
    )
      .then((r) => r.json())
      .then((data) => {
        const addr = data.display_name?.split(",").slice(0, 3).join(",").trim();
        if (addr) setAddress(addr);
      })
      .catch(() => {});
  });

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!category) return;
    setLoading(true);
    setError("");

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const { data, error } = await insforge.storage
          .from("report-images")
          .upload(`reports/${Date.now()}-${imageFile.name}`, imageFile);
        if (data && !error) {
          imageUrl = data.url;
        }
      }

      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          category,
          description: description.trim() || undefined,
          image_url: imageUrl,
          lat: userLocation.lat,
          lng: userLocation.lng,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/[0.08] bg-[#12121a] p-6 text-center">
          <CheckCircle className="size-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">Report Submitted</h3>
          <p className="text-sm text-white/40 mb-5">
            Your report will appear on the map shortly.
          </p>
          <Button
            onClick={() => { onClose(); onSubmitted(); }}
            className="w-full h-9 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm cursor-pointer"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-2xl border border-white/[0.08] bg-[#12121a] overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white">Report Incident</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/30 hover:text-white/60 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Location */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <MapPin className="size-3.5 text-[#7ba4ff] shrink-0" />
            <span className="text-xs text-white/50 truncate">{address}</span>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-white/50 block mb-2">
              What happened?
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((cat) => {
                const data = CATEGORY_DATA[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left text-xs ${
                      active
                        ? data.color
                        : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span>{data.emoji}</span>
                    <span className="font-medium">{data.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-white/50 block mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you see?"
              rows={2}
              className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#4d7fff]/50 resize-none"
            />
          </div>

          {/* Photo */}
          {imagePreview ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setImageFile(null);
                  if (imagePreview) URL.revokeObjectURL(imagePreview);
                  setImagePreview(null);
                }}
                className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 flex items-center justify-center cursor-pointer"
              >
                <X className="size-3 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] transition-all cursor-pointer w-fit text-xs">
              <Camera className="size-3.5" />
              Attach Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !category}
            className="w-full h-9 bg-[#4d7fff] text-white hover:bg-[#5a88ff] rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Submit Report"}
          </Button>
        </form>
      </div>
    </div>
  );
}
