"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Shield } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Is it safe to walk near campus at 11pm?",
  "What happened near downtown today?",
  "Safety tips for my area",
];

export default function ChatPage() {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get user location on mount
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Default to Tempe/ASU
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

      // Add empty assistant message that we'll stream into
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
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
                };
                return updated;
              });
            } else if (event.type === "cards") {
              // Format card data as readable text
              const cardData = event.data;
              let cardText = cardData.summary || "";
              if (cardData.incidents?.length) {
                cardText += "\n\n";
                for (const inc of cardData.incidents) {
                  cardText += `• ${inc.category}: ${inc.description || "No description"}`;
                  if (inc.distance_miles != null) {
                    cardText += ` (${inc.distance_miles.toFixed(1)} mi away)`;
                  }
                  cardText += "\n";
                }
              }
              assistantContent = cardText.trim();
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
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
      if (!assistantContent) {
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
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." },
      ]);
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
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#4d7fff] text-white"
                  : "bg-white/[0.05] text-white/70 border border-white/[0.06]"
              }`}
            >
              {msg.content || (
                <Loader2 className="size-4 text-white/30 animate-spin" />
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-[#4d7fff]/20 flex items-center justify-center shrink-0 mb-0.5 text-[10px] font-semibold text-[#7ba4ff]">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/[0.06] rounded-2xl px-4 py-3">
              <Loader2 className="size-4 text-white/30 animate-spin" />
            </div>
          </div>
        )}
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
