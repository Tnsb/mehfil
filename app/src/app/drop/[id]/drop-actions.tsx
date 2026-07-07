"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

const INTENTS = [
  { key: "vibe", label: "Vibe", emoji: "🫶" },
  { key: "collab", label: "Collab", emoji: "⚡" },
  { key: "crush", label: "Crush", emoji: "💘" },
] as const;

type TapState =
  | { kind: "none" }
  | { kind: "tapped" }
  | { kind: "matched"; intentLabel: string; chatUrl: string };

/**
 * The Taps row: pick one of three intents. Double-blind — after tapping you
 * only ever see "Tapped ✓" unless it becomes a match.
 */
export function TapButtons({
  eventId,
  toUserId,
  initialState,
}: {
  eventId: string;
  toUserId: string;
  initialState: TapState;
}) {
  const router = useRouter();
  const [state, setState] = useState<TapState>(initialState);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (state.kind === "matched") {
    return (
      <Link
        href={state.chatUrl}
        className="pill bg-[color:var(--color-mint-soft)] text-[color:var(--color-mint)] font-bold hover:brightness-95"
      >
        {state.intentLabel} match — open chat
      </Link>
    );
  }
  if (state.kind === "tapped") {
    return (
      <span className="pill bg-[color:var(--color-cream-deep)] text-[color:var(--color-ink-faint)]">
        Tapped ✓ sealed
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {INTENTS.map((i) => (
          <button
            key={i.key}
            title={i.label}
            disabled={pending}
            className="pill !px-2.5 !py-1.5 !text-xs bg-white border border-[color:var(--color-ink)]/15 hover:border-[color:var(--color-grape)] hover:bg-[color:var(--color-grape-soft)] transition-colors"
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const res = await toolAction("tap_connect", { eventId, toUserId, intent: i.key });
                if (!res.ok) return setError(res.error);
                const d = res.data as { mutual: boolean; intent?: string; chatUrl?: string };
                if (d.mutual && d.chatUrl) {
                  const meta = INTENTS.find((x) => x.key === d.intent);
                  setState({
                    kind: "matched",
                    intentLabel: meta ? `${meta.emoji} ${meta.label}` : "🤝",
                    chatUrl: d.chatUrl,
                  });
                  router.refresh();
                } else {
                  setState({ kind: "tapped" });
                }
              })
            }
          >
            {i.emoji} {i.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-[11px] text-[color:var(--color-tangerine-deep)] font-medium">{error}</p>
      ) : null}
    </div>
  );
}

export function RunItBackButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <button
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("run_it_back", { eventId }, ["/host"]);
            if (!res.ok) return setError(res.error);
            const evt = (res.data as { event: { id: string } }).event;
            router.push(`/host/events/${evt.id}`);
          })
        }
      >
        {pending ? "Setting the sequel…" : "🔁 Run it back — same time next week"}
      </button>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        Clones the event one week out. Publish it and everyone from tonight gets first access.
      </p>
    </div>
  );
}
