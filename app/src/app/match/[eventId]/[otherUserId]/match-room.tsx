"use client";

/**
 * The private chat for a matched pair — opened by the Cohost's wingman
 * message, then handed over to the two humans.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { toolAction } from "@/app/actions";

type ChatMessage = {
  id: string;
  kind: "chat" | "cohost" | "system";
  author: string;
  isSelf: boolean;
  body: string;
  at?: string;
};

export function MatchRoom({
  eventId,
  otherUserId,
  initialMessages,
}: {
  eventId: string;
  otherUserId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(initialMessages.length);

  async function refresh() {
    const res = await toolAction("get_match_chat", { eventId, otherUserId });
    if (res.ok) {
      const next = (res.data as { messages: ChatMessage[] }).messages;
      if (next.length !== countRef.current) {
        countRef.current = next.length;
        setMessages(next);
      }
    }
  }

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function send() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setError(undefined);
    startTransition(async () => {
      const res = await toolAction("post_match_message", { eventId, otherUserId, body: text });
      if (!res.ok) return setError(res.error);
      await refresh();
    });
  }

  return (
    <div className="card overflow-hidden flex flex-col" style={{ height: "26rem" }}>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.isSelf ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.kind === "cohost"
                  ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-[color:var(--color-grape-soft)] border border-[color:var(--color-grape)]/25 px-3 py-2"
                  : m.isSelf
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--color-ink)] text-[color:var(--color-cream)] px-3 py-2"
                    : "max-w-[85%] rounded-2xl rounded-bl-sm bg-[color:var(--color-cream-deep)] px-3 py-2"
              }
            >
              {!m.isSelf ? (
                <p
                  className={`text-[11px] font-bold mb-0.5 ${m.kind === "cohost" ? "text-[color:var(--color-grape)]" : "text-[color:var(--color-ink-soft)]"}`}
                >
                  {m.author}
                </p>
              ) : null}
              <p className="text-sm whitespace-pre-line leading-relaxed">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-2.5 border-t border-[color:var(--color-ink)]/8">
        {error ? (
          <p className="text-xs text-[color:var(--color-tangerine-deep)] font-medium mb-1.5">{error}</p>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            className="field !py-2 !rounded-full"
            placeholder="the Cohost warmed it up — go"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-grape !px-4 !py-2" disabled={pending || !input.trim()} type="submit">
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
