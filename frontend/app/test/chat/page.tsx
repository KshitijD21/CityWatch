"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Send, MapPin, Shield, AlertTriangle, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface IncidentCard {
  id: string;
  category: string;
  description?: string;
  occurred_at: string;
  source: string;
  verified: boolean;
  lat: number;
  lng: number;
  location_name?: string;
  distance_miles?: number;
}

interface CardData {
  mode: "cards";
  summary: string;
  incidents: IncidentCard[];
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  lane?: number;
  cards?: CardData;
}

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
  theft: "warning",
  assault: "destructive",
  vandalism: "warning",
  harassment: "destructive",
  vehicle_breakin: "warning",
  disturbance: "secondary",
  infrastructure: "outline",
  other: "secondary",
};

function IncidentCardComponent({ incident }: { incident: IncidentCard }) {
  const variant = CATEGORY_VARIANTS[incident.category] || "secondary";
  const time = new Date(incident.occurred_at).toLocaleString();

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 transition-colors hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <Badge variant={variant} className="capitalize">
          {incident.category.replace("_", " ")}
        </Badge>
        <div className="flex items-center gap-1.5">
          {incident.verified && (
            <Badge variant="success" className="text-[10px]">
              <Shield className="size-2.5 mr-0.5" />
              verified
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {incident.source}
          </Badge>
        </div>
      </div>
      {incident.description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {incident.description}
        </p>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {time}
        </span>
        <span className="flex items-center gap-1 text-right max-w-[50%] truncate">
          <MapPin className="size-3 shrink-0" />
          {incident.location_name || `${incident.distance_miles?.toFixed(2)} mi away`}
        </span>
      </div>
    </div>
  );
}

export default function TestChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        message: text,
        session_id: sessionId,
      };

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 3000,
            })
          );
          body.user_lat = pos.coords.latitude;
          body.user_lng = pos.coords.longitude;
        } catch {
          // GPS unavailable
        }
      }

      const res = await fetch(`${API_URL}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let currentLane = 1;
      let assistantText = "";
      let cardData: CardData | undefined;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", lane: 1 },
      ]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === "session") {
              setSessionId(event.session_id);
            } else if (event.type === "stream_start") {
              currentLane = event.lane || 1;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") last.lane = currentLane;
                return updated;
              });
            } else if (event.type === "token") {
              assistantText += event.content;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") last.content = assistantText;
                return updated;
              });
            } else if (event.type === "cards") {
              cardData = event.data;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.cards = cardData;
                  last.content = cardData?.summary || "";
                  last.lane = currentLane;
                }
                return updated;
              });
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant")
                  last.content = `Error: ${event.content}`;
                return updated;
              });
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border shrink-0">
        <div className="max-w-2xl mx-auto w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">CityWatch</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Safety Assistant
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono">
            {sessionId ? sessionId.slice(0, 8) : "new session"}
          </Badge>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-24 pb-12 space-y-6">
              <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                <AlertTriangle className="size-7 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-medium">Ask about safety near a location</h2>
                <p className="text-sm text-muted-foreground">
                  Get real-time incident data and safety insights
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {[
                  "What's happening near Downtown Phoenix?",
                  "Show me incidents near Central Ave",
                  "Is McDowell Rd area safe at night?",
                  "Where is Anirudh, is he safe?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="text-left text-xs text-muted-foreground border border-border rounded-lg px-3 py-2.5 hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {q}
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
                className={`max-w-[85%] sm:max-w-[75%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                    : "space-y-2"
                }`}
              >
                {msg.role === "assistant" && (
                  <>
                    {/* Lane badge */}
                    {msg.lane && (
                      <Badge
                        variant={msg.lane === 1 ? "secondary" : "outline"}
                        className="text-[10px] mb-1"
                      >
                        {msg.lane === 1 ? "Location Query" : "People / ReAct"}
                      </Badge>
                    )}

                    {/* Card mode */}
                    {msg.cards ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{msg.cards.summary}</p>
                        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                          {msg.cards.incidents.map((inc) => (
                            <IncidentCardComponent key={inc.id} incident={inc} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Text mode */
                      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                          {loading &&
                            i === messages.length - 1 && (
                              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
                            )}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {msg.role === "user" && (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border shrink-0">
        <div className="max-w-2xl mx-auto w-full px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about safety near a location..."
              disabled={loading}
              className="h-10 bg-muted/50 border-border"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              className="size-10 shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
