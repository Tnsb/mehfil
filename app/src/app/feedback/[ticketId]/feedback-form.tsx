"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toolAction } from "@/app/actions";

export function FeedbackForm({ ticketId }: { ticketId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="card p-8 text-center reveal-open">
        <p className="text-5xl mb-3">{rating >= 4 ? "🥂" : "🙏"}</p>
        <p className="font-display text-2xl font-semibold">{done}</p>
        <Link href="/" className="btn btn-primary mt-6">
          Find your next table
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} stars`}
            className="text-4xl transition-transform duration-150 hover:scale-110 active:scale-95"
            style={{ opacity: (hover || rating) >= n ? 1 : 0.25 }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            ⭐
          </button>
        ))}
      </div>
      <textarea
        className="field min-h-24"
        placeholder={rating >= 4 ? "What made the night?" : rating > 0 ? "What should the host know? (goes privately to them)" : "How was it?"}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {rating > 0 && rating < 4 ? (
        <p className="text-xs text-[color:var(--color-ink-faint)] text-center">
          Ratings under 4★ go privately to the host — honesty helps.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium text-center">{error}</p> : null}
      <button
        className="btn btn-primary w-full"
        disabled={rating === 0 || pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("submit_feedback", {
              ticketId,
              rating,
              comment: comment || undefined,
            });
            if (!res.ok) return setError(res.error);
            setDone((res.data as { message: string }).message);
          })
        }
      >
        {pending ? "Sending…" : "Send it"}
      </button>
    </div>
  );
}
