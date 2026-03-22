"use client";

import React, { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Loader2,
  Shield,
  MapPin,
  Clock,
  AlertTriangle,
  Car,
  Users,
  Megaphone,
  Wrench,
  ShieldAlert,
  Eye,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={j} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const TIP_ICONS = [Shield, Eye, ShieldAlert, AlertTriangle, Car, MapPin, Users, Wrench];

function RichTextCard({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());

  // Separate numbered items from other text
  const intro: string[] = [];
  const tips: { title: string; body: string }[] = [];
  const outro: string[] = [];
  let pastTips = false;

  for (const line of lines) {
    const match = line.match(/^\d+\.\s*\*?\*?(.+)/);
    if (match) {
      // Parse "**Title**: body" or "Title: body"
      const content = match[1];
      const colonMatch = content.match(/^\*?\*?([^:*]+)\*?\*?[:\s]*(.*)$/);
      if (colonMatch) {
        tips.push({ title: colonMatch[1].trim(), body: colonMatch[2].trim() });
      } else {
        tips.push({ title: content.replace(/\*\*/g, "").trim(), body: "" });
      }
    } else if (tips.length === 0) {
      intro.push(line.trim());
    } else {
      pastTips = true;
      outro.push(line.trim());
    }
  }

  // If no structured tips found, just render as styled paragraphs
  if (tips.length === 0) {
    return (
      <div className="space-y-3">
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-white/60 leading-relaxed">
            {renderBold(line)}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Intro */}
      {intro.map((line, i) => (
        <p key={`intro-${i}`} className="text-sm text-white/60 leading-relaxed">
          {renderBold(line)}
        </p>
      ))}

      {/* Tips as cards */}
      <div className="space-y-2 mt-1">
        {tips.map((tip, i) => {
          const Icon = TIP_ICONS[i % TIP_ICONS.length];
          return (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.04]"
            >
              <div className="w-7 h-7 rounded-lg bg-[#4d7fff]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="size-3.5 text-[#7ba4ff]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/80">{tip.title}</p>
                {tip.body && (
                  <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{tip.body}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Outro / disclaimer */}
      {outro.map((line, i) => (
        <p key={`outro-${i}`} className="text-[11px] text-white/30 leading-relaxed">
          {renderBold(line)}
        </p>
      ))}
    </div>
  );
}

function avatarUrl(name: string): string {
  return `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

interface IncidentCard {
  id?: string;
  category: string;
  description?: string;
  occurred_at?: string;
  source?: string;
  verified?: boolean;
  lat: number;
  lng: number;
  distance_miles?: number;
}

interface CardData {
  summary: string;
  incidents: IncidentCard[];
}

interface PersonLocation {
  name: string;
  lat: number;
  lng: number;
  address: string;
  updated_ago?: string;
  is_stale?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  cards?: CardData;
  personLocation?: PersonLocation;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; color: string; bg: string }> = {
  theft: { icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10" },
  assault: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
  vandalism: { icon: Wrench, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  harassment: { icon: Megaphone, color: "text-pink-400", bg: "bg-pink-500/10" },
  vehicle_breakin: { icon: Car, color: "text-amber-400", bg: "bg-amber-500/10" },
  disturbance: { icon: AlertTriangle, color: "text-purple-400", bg: "bg-purple-500/10" },
  infrastructure: { icon: Wrench, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  other: { icon: Shield, color: "text-white/50", bg: "bg-white/5" },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    // Handle future timestamps (timezone mismatch) — show absolute time
    if (diff < 0) {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "";
  }
}

const QUICK_PROMPTS = [
  "Is it safe to walk near campus at 11pm?",
  "What happened near downtown today?",
  "Safety tips for my area",
];

function IncidentCards({ data }: { data: CardData }) {
  const categoryCount: Record<string, number> = {};
  for (const inc of data.incidents) {
    categoryCount[inc.category] = (categoryCount[inc.category] || 0) + 1;
  }

  return (
    <div className="space-y-3 mt-2">
      {/* Summary */}
      {data.summary && (
        <p className="text-sm text-white/60 leading-relaxed">{data.summary}</p>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(categoryCount).map(([cat, count]) => {
          const cfg = getCategoryConfig(cat);
          return (
            <span
              key={cat}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.color}`}
            >
              <cfg.icon className="size-2.5" />
              {count} {cat.replace("_", " ")}
            </span>
          );
        })}
      </div>

      {/* Incident list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {data.incidents.slice(0, 8).map((inc, i) => {
          const cfg = getCategoryConfig(inc.category);
          return (
            <div
              key={inc.id || i}
              className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]"
            >
              <div className={`w-6 h-6 rounded-md ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                <cfg.icon className={`size-3 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/70 capitalize">
                    {inc.category.replace("_", " ")}
                  </span>
                  {inc.distance_miles != null && (
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                      <MapPin className="size-2.5" />
                      {inc.distance_miles.toFixed(1)} mi
                    </span>
                  )}
                  {inc.occurred_at && (
                    <span className="text-[10px] text-white/25 flex items-center gap-0.5 ml-auto">
                      <Clock className="size-2.5" />
                      {timeAgo(inc.occurred_at)}
                    </span>
                  )}
                </div>
                {inc.description && (
                  <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{inc.description}</p>
                )}
              </div>
            </div>
          );
        })}
        {data.incidents.length > 8 && (
          <p className="text-[10px] text-white/25 text-center py-1">
            +{data.incidents.length - 8} more incidents
          </p>
        )}
      </div>

    </div>
  );
}

function PersonLocationCard({ data }: { data: PersonLocation }) {
  return (
    <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl(data.name)}
          alt={data.name}
          className="w-10 h-10 rounded-full border-2 border-emerald-500/40"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{data.name}</span>
            {data.is_stale && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                may be outdated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="size-3 text-emerald-400" />
            <span className="text-xs text-white/50">{data.address}</span>
          </div>
          {data.updated_ago && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="size-3 text-white/25" />
              <span className="text-[10px] text-white/30">{data.updated_ago}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem("chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("chat_session_id");
  });
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist messages and session to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);
  useEffect(() => {
    if (sessionId) sessionStorage.setItem("chat_session_id", sessionId);
  }, [sessionId]);

  // Get user location on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setUserCoords({ lat: 33.4255, lng: -111.94 });
      },
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: text.trim(),
          user_lat: userCoords?.lat,
          user_lng: userCoords?.lng,
          session_id: sessionId,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let cardData: CardData | undefined;

      // Add empty assistant message that we'll stream into
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "session") {
              setSessionId(event.session_id);
            } else if (event.type === "stream_start") {
              setLoading(false);
            } else if (event.type === "token") {
              assistantContent += event.content;
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  cards: cardData,
                };
                return updated;
              });
            } else if (event.type === "cards") {
              cardData = event.data;
              assistantContent = event.data.summary || "";
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  cards: cardData,
                };
                return updated;
              });
              setLoading(false);
            } else if (event.type === "person_location") {
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  personLocation: event.data,
                };
                return updated;
              });
            } else if (event.type === "error") {
              assistantContent = event.content || "Something went wrong.";
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // If we never got any content, show a fallback
      if (!assistantContent && !cardData) {
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "I couldn't process that request. Please try again.",
          };
          return updated;
        });
      }
    } catch {
      setMessages((m) => {
        const updated = [...m];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I'm having trouble connecting. Please try again.",
          };
        } else {
          updated.push({
            role: "assistant",
            content: "Sorry, I'm having trouble connecting. Please try again.",
          });
        }
        return updated;
      });
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="h-dvh bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] shrink-0">
        <Link href="/map" className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[#6c9cff]" />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Shield className="size-10 text-[#4d7fff]/30 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-white/70 mb-2">
              Ask me anything about safety
            </h2>
            <p className="text-sm text-white/30 mb-6 max-w-xs mx-auto">
              I can help with area safety info, incident details, and safety tips.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#4d7fff]/15 flex items-center justify-center shrink-0 mb-0.5">
                <Shield className="size-3.5 text-[#7ba4ff]" />
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "max-w-[75%] bg-[#4d7fff] text-white whitespace-pre-wrap"
                  : msg.cards || msg.personLocation
                  ? "max-w-[90%] bg-white/[0.05] text-white/70 border border-white/[0.06] whitespace-pre-wrap"
                  : "max-w-[75%] bg-white/[0.05] text-white/70 border border-white/[0.06] whitespace-pre-wrap"
              }`}
            >
              {msg.cards ? (
                <IncidentCards data={msg.cards} />
              ) : msg.content ? (
                <>
                  {msg.role === "assistant" ? <RichTextCard text={msg.content} /> : msg.content}
                  {msg.personLocation && <PersonLocationCard data={msg.personLocation} />}
                </>
              ) : (
                <span className="flex items-center gap-1 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
            {msg.role === "user" && (
              <img
                src={avatarUrl(user?.name || "User")}
                alt="You"
                className="w-7 h-7 rounded-full shrink-0 mb-0.5 border border-[#4d7fff]/30"
              />
            )}
          </div>
        ))}

      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 px-4 py-3 border-t border-white/[0.06]"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about safety..."
            className="flex-1 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#4d7fff]/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 w-10 rounded-xl bg-[#4d7fff] text-white flex items-center justify-center hover:bg-[#5a88ff] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
