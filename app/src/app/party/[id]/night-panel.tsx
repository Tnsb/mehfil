"use client";

/**
 * The during-the-night panel: self check-in, Overheard submissions,
 * and secret superlative voting. All of it feeds the morning Reveal.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

export function CheckInCard({
  ticketId,
  hasDeposit,
}: {
  ticketId: string;
  hasDeposit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="card p-4 space-y-2 !bg-[color:var(--color-mint-soft)]">
      <button
        className="btn btn-ink w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("check_in_guest", { ticketId });
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Checking you in…" : "🚪 I'm here — check me in"}
      </button>
      <p className="text-xs text-center text-[color:var(--color-ink-soft)]">
        {hasDeposit
          ? "Checking in releases your deposit hold and unlocks your One Shot."
          : "Checking in unlocks your One Shot and puts you on the night's record."}
      </p>
      {error ? (
        <p className="text-xs text-center text-[color:var(--color-tangerine-deep)] font-medium">{error}</p>
      ) : null}
    </div>
  );
}

export function OverheardCard({ eventId }: { eventId: string }) {
  const [quote, setQuote] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="card p-4 space-y-2">
      <p className="font-semibold text-sm">🗣 Overheard</p>
      <p className="text-xs text-[color:var(--color-ink-faint)]">
        Someone just said something? Log it anonymously — the best ones become cards at the Reveal.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = quote.trim();
          if (!q) return;
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("submit_overheard", { eventId, quote: q });
            if (!res.ok) return setError(res.error);
            setQuote("");
            setStatus((res.data as { message: string }).message);
            setTimeout(() => setStatus(undefined), 3500);
          });
        }}
      >
        <input
          className="field !py-2"
          placeholder={"\u201cI would simply not have done the crime\u201d"}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          maxLength={280}
        />
        <button className="btn btn-ink !px-4 !py-2" disabled={pending || !quote.trim()} type="submit">
          🤫
        </button>
      </form>
      {status ? <p className="text-xs text-[color:var(--color-fern,#4d7c0f)] font-medium">{status}</p> : null}
      {error ? <p className="text-xs text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
    </div>
  );
}

export function SuperlativeBallot({
  eventId,
  categories,
  guests,
}: {
  eventId: string;
  categories: string[];
  guests: { userId: string; name: string }[];
}) {
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  if (guests.length === 0) return null;

  function cast(category: string, votedForUserId: string) {
    setVotes((v) => ({ ...v, [category]: votedForUserId }));
    startTransition(async () => {
      setError(undefined);
      const res = await toolAction("vote_superlative", { eventId, category, votedForUserId });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="font-semibold text-sm">🗳 Tonight&apos;s awards — vote in secret</p>
      <p className="text-xs text-[color:var(--color-ink-faint)]">
        Winners are crowned at the morning Reveal. Re-tap to change your vote.
      </p>
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold mb-1">{cat}</p>
          <div className="flex flex-wrap gap-1.5">
            {guests.map((g) => (
              <button
                key={g.userId}
                type="button"
                disabled={pending}
                onClick={() => cast(cat, g.userId)}
                className={`pill text-xs transition ${votes[cat] === g.userId ? "bg-[color:var(--color-ink)] text-[color:var(--color-cream)]" : "bg-[color:var(--color-cream-deep)]"}`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error ? <p className="text-xs text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
    </div>
  );
}
