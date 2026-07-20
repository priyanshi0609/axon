"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ChatResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  meta?: ChatResponse;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-red-500",
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.askQuestion(question);
      setMessages((prev) => [...prev, { role: "assistant", text: response.answer, meta: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong reaching Axon. Is the backend running?" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] max-w-2xl mx-auto border rounded-xl">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-10">
            Ask Axon anything about your uploaded documents — e.g. "Has Pump P204 failed before?"
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m.text}
            </div>

            {m.meta && (
              <div className="mt-1 text-xs text-muted-foreground space-y-1">
                <p>
                  Confidence:{" "}
                  <span className={CONFIDENCE_COLOR[m.meta.confidence]}>{m.meta.confidence}</span>
                </p>
                {m.meta.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.meta.sources.map((s, idx) => (
                      <span key={idx} className="flex items-center gap-1 bg-muted/60 rounded px-2 py-0.5">
                        <FileText className="h-3 w-3" /> {s.filename} ({s.score.toFixed(2)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Axon is reasoning across your documents...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about equipment, failures, compliance..."
          className="flex-1 rounded-md border px-3 py-2 text-sm outline-none"
        />
        <Button onClick={send} disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
