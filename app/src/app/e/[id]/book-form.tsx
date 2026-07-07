"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";
import type { EventQuestion } from "@/db/schema";

export function BookForm({
  eventId,
  questions,
  price,
  soldOut,
}: {
  eventId: string;
  questions: EventQuestion[];
  price: string;
  soldOut: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function book() {
    setError(undefined);
    startTransition(async () => {
      const res = await toolAction("book_seat", { eventId, answers }, [`/e/${eventId}`]);
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        book();
      }}
      className="space-y-4"
    >
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
      {error ? (
        <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p>
      ) : null}
      <button className={`btn w-full ${soldOut ? "btn-ink" : "btn-primary"}`} disabled={pending} type="submit">
        {pending ? "Holding your seat…" : soldOut ? "Join the waitlist" : `Grab a seat · ${price}`}
      </button>
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        The exact address unlocks after payment.
      </p>
    </form>
  );
}
