"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toolAction } from "@/app/actions";
import type { EventQuestion } from "@/db/schema";
import { VIBE_CHECK } from "@/themes";

export function BookForm({
  eventId,
  questions,
  price,
  soldOut,
  mysterySeatOpen,
  mysteryPrice,
  duoTickets,
  duoPrice,
  needsWaiver,
  depositLabel,
}: {
  eventId: string;
  questions: EventQuestion[];
  price: string;
  soldOut: boolean;
  mysterySeatOpen: boolean;
  mysteryPrice: string;
  duoTickets: boolean;
  duoPrice: string;
  needsWaiver: boolean;
  depositLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [vibeAnswers, setVibeAnswers] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"standard" | "mystery" | "duo">("standard");
  const [waiverOk, setWaiverOk] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function book() {
    setError(undefined);
    if (needsWaiver && !waiverOk) return setError("Please accept the waiver to book.");
    startTransition(async () => {
      const res = await toolAction(
        "book_seat",
        {
          eventId,
          answers,
          kind,
          ...(Object.keys(vibeAnswers).length > 0 ? { vibeAnswers } : {}),
          ...(needsWaiver ? { acceptWaiver: waiverOk } : {}),
          ...(searchParams.get("ref") ? { referredBy: searchParams.get("ref") } : {}),
        },
        [`/e/${eventId}`],
      );
      if (!res.ok) return setError(res.error);
      const data = res.data as { status: string; paymentUrl?: string; ticketId: string };
      if (data.status === "paid") {
        router.push(`/e/${eventId}/success?ticket=${data.ticketId}`);
      } else if (data.paymentUrl) {
        if (data.paymentUrl.startsWith("http")) window.location.href = data.paymentUrl;
        else router.push(data.paymentUrl);
      } else {
        router.refresh(); // waitlisted — page re-renders with the new state
      }
    });
  }

  const showKinds = !soldOut && (mysterySeatOpen || duoTickets);
  const cta =
    kind === "mystery"
      ? `🎭 Take the mystery seat · ${mysteryPrice}`
      : kind === "duo"
        ? `👯 Grab a duo · ${duoPrice} for two`
        : `Grab a seat · ${price}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        book();
      }}
      className="space-y-4"
    >
      {showKinds ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">How are you coming?</p>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setKind("standard")}
              className={`rounded-[var(--radius-pill)] border-2 px-4 py-2.5 text-left text-sm transition ${kind === "standard" ? "border-[color:var(--color-ink)] bg-[color:var(--color-butter-soft)]" : "border-black/10 bg-white"}`}
            >
              <span className="font-semibold">🎟 Standard seat</span> · {price}
            </button>
            {mysterySeatOpen ? (
              <button
                type="button"
                onClick={() => setKind("mystery")}
                className={`rounded-[var(--radius-pill)] border-2 px-4 py-2.5 text-left text-sm transition ${kind === "mystery" ? "border-[color:var(--color-ink)] bg-[color:var(--color-butter-soft)]" : "border-black/10 bg-white"}`}
              >
                <span className="font-semibold">🎭 The mystery seat</span> · {mysteryPrice} — one per
                event, 20% off, you commit before you overthink
              </button>
            ) : null}
            {duoTickets ? (
              <button
                type="button"
                onClick={() => setKind("duo")}
                className={`rounded-[var(--radius-pill)] border-2 px-4 py-2.5 text-left text-sm transition ${kind === "duo" ? "border-[color:var(--color-ink)] bg-[color:var(--color-butter-soft)]" : "border-black/10 bg-white"}`}
              >
                <span className="font-semibold">👯 Duo ticket</span> · {duoPrice} for two — your +1
                must be new to plot
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {questions.map((q) => (
        <div key={q.key}>
          <label className="block text-sm font-semibold mb-1.5">{q.label}</label>
          <input
            className="field"
            placeholder="None"
            value={answers[q.key] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
          />
        </div>
      ))}

      {!soldOut ? (
        <div className="space-y-3 rounded-[var(--radius-card)] bg-[color:var(--color-butter-soft)] p-3.5">
          <p className="text-sm font-semibold">✨ 30-second vibe check <span className="font-normal text-[color:var(--color-ink-faint)]">(optional — helps the Cohost seat &amp; match you)</span></p>
          {VIBE_CHECK.map((q) => (
            <div key={q.id}>
              <p className="text-xs font-medium text-[color:var(--color-ink-soft)] mb-1">{q.prompt}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() =>
                      setVibeAnswers((v) =>
                        v[q.id] === o.key ? { ...v, [q.id]: undefined as unknown as string } : { ...v, [q.id]: o.key },
                      )
                    }
                    className={`pill text-xs transition ${vibeAnswers[q.id] === o.key ? "bg-[color:var(--color-ink)] text-[color:var(--color-cream)]" : "bg-white"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {needsWaiver ? (
        <label className="flex items-start gap-2.5 text-sm rounded-[var(--radius-card)] bg-[color:var(--color-blush)] p-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={waiverOk}
            onChange={(e) => setWaiverOk(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <strong>Activity waiver.</strong> This is a physical event — I confirm I&apos;m
            participating at my own risk and I&apos;m fit to take part.
          </span>
        </label>
      ) : null}

      {error ? (
        <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p>
      ) : null}
      <button className={`btn w-full ${soldOut ? "btn-ink" : "btn-primary"}`} disabled={pending} type="submit">
        {pending ? "Holding your seat…" : soldOut ? "Join the waitlist" : cta}
      </button>
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        {depositLabel
          ? `Free with a ${depositLabel} refundable hold — it's back the second you check in at the door.`
          : "The exact address unlocks after payment."}
      </p>
    </form>
  );
}
