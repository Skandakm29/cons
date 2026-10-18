"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendMessageAction } from "@/lib/actions/bids";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
}

export function ChatPanel({ bidId, messages, disabled, note }: { bidId: string; messages: ChatMessage[]; disabled: boolean; note?: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages.length]);
  // Lightweight polling so the other side's replies appear without a reload.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    const res = await sendMessageAction({ bidId, body });
    setSending(false);
    if (!res.ok) return setError(res.error);
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      <div className="max-h-[28rem] min-h-[12rem] space-y-3 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Ask about BOQ details, materials or site visits.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm", m.mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {m.body}
              </div>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{m.mine ? "You" : m.senderName} · {formatDateTime(m.createdAt)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex flex-col gap-2 border-t p-3">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        <label htmlFor="chat-body" className="sr-only">Message</label>
        <div className="flex gap-2">
          <Textarea
            id="chat-body"
            rows={2}
            className="min-h-0"
            placeholder={disabled ? "This conversation is closed" : "Type a message…"}
            value={body}
            disabled={disabled}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
          />
          <Button type="submit" size="icon" className="h-auto" disabled={disabled || sending || !body.trim()} aria-label="Send">
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      </form>
    </div>
  );
}
