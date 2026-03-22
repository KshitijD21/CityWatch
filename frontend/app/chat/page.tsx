"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-10),
        }),
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.response || res.message || "I couldn't process that request." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." },
      ]);
    } finally {
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
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#4d7fff] text-white"
                  : "bg-white/[0.05] text-white/70 border border-white/[0.06]"
              }`}
            >
              {msg.content}
            </div>
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
