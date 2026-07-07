"use client";

/**
 * The agent chat surface. Talks to /api/chat, which runs the SAME tool
 * registry the buttons use. Tool calls render as small chips so you can see
 * the crew working.
 */
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";

const SUGGESTIONS_HOST = [
  "Host a six-course Oaxacan dinner Saturday, 10 seats, $85",
  "Who's coming to my dinner?",
  "What's happening this week?",
  "How did my last dinner go?",
];

const SUGGESTIONS_GUEST = ["What's happening this week?", "What am I going to?"];

/** minimal markdown: **bold**, [links](…), bullet lines, line breaks */
function renderText(text: string) {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 ? <br /> : null}
      {renderInline(line)}
    </Fragment>
  ));
}

function renderInline(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    if (m[1]) out.push(<strong key={key++}>{m[1]}</strong>);
    else
      out.push(
        <Link key={key++} href={m[3]} className="underline underline-offset-2 font-semibold text-[color:var(--color-tangerine-deep)]">
          {m[2]}
        </Link>,
      );
    last = re.lastIndex;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function toolName(partType: string, part: { toolName?: string }): string {
  if (part.toolName) return part.toolName;
  return partType.replace(/^tool-/, "");
}

export function ChatUI({ isSignedIn, isHost }: { isSignedIn: boolean; isHost: boolean }) {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    void sendMessage({ text: t });
  }

  const suggestions = isHost || !isSignedIn ? SUGGESTIONS_HOST : SUGGESTIONS_GUEST;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-1px)] md:h-[calc(100dvh-3.5rem-1px)]">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-4 pb-40">
          {messages.length === 0 ? (
            <div className="text-center pt-10 rise-in">
              <div className="mx-auto size-16 rounded-full hero-gradient flex items-center justify-center text-white text-2xl shadow-[var(--shadow-warm-lg)]">
                ◈
              </div>
              <h1 className="font-display text-3xl font-semibold mt-4">Your crew is listening</h1>
              <p className="text-[color:var(--color-ink-soft)] mt-1.5 max-w-sm mx-auto">
                Describe a dinner in one sentence and it becomes a live, bookable page.
              </p>
              <div className="mt-6 flex flex-col gap-2 items-stretch max-w-sm mx-auto">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="card px-4 py-3 text-sm text-left hover:-translate-y-0.5 transition-transform"
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {!isSignedIn ? (
                <p className="text-sm text-[color:var(--color-ink-soft)] mt-5">
                  <Link href="/login?next=/chat" className="font-semibold underline underline-offset-2">
                    Sign in
                  </Link>{" "}
                  to host or book through the crew.
                </p>
              ) : null}
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-3xl rounded-br-md bg-[color:var(--color-ink)] text-[color:var(--color-cream)] px-4 py-2.5 text-[15px] leading-relaxed"
                    : "max-w-[85%] space-y-2"
                }
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return message.role === "user" ? (
                      <span key={i}>{part.text}</span>
                    ) : (
                      <div
                        key={i}
                        className="card rounded-3xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed"
                      >
                        {renderText(part.text)}
                      </div>
                    );
                  }
                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const p = part as { type: string; toolName?: string; state?: string };
                    return (
                      <div key={i} className="pill bg-[color:var(--color-grape-soft)] text-[color:var(--color-grape)]">
                        ⚙ {toolName(p.type, p)}
                        {p.state && !String(p.state).includes("output") ? "…" : " ✓"}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {busy && messages[messages.length - 1]?.role === "user" ? (
            <div className="flex justify-start">
              <div className="card rounded-3xl rounded-bl-md px-4 py-3 flex gap-1.5">
                <span className="typing-dot size-2 rounded-full bg-[color:var(--color-grape)]" />
                <span className="typing-dot size-2 rounded-full bg-[color:var(--color-grape)]" />
                <span className="typing-dot size-2 rounded-full bg-[color:var(--color-grape)]" />
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <p className="text-sm text-center text-[color:var(--color-tangerine-deep)] font-medium">
              The crew dropped a plate — try sending that again.
            </p>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed bottom-[calc(3.7rem+env(safe-area-inset-bottom))] md:bottom-0 inset-x-0 bg-gradient-to-t from-[color:var(--color-cream)] via-[color:var(--color-cream)]/95 to-transparent pt-6 pb-3">
        <form
          className="mx-auto max-w-2xl px-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="field !rounded-full !py-3 shadow-[var(--shadow-warm)]"
            placeholder='Try: "host a pasta night Friday, 8 seats, $40"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button className="btn btn-grape !px-5" disabled={busy || !input.trim()} type="submit">
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
