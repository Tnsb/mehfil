"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toolAction } from "@/app/actions";

/** Publish flow — the compliance touchpoint. Terms must be accepted explicitly. */
export function PublishPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[color:var(--color-tangerine)]"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span className="text-[color:var(--color-ink-soft)]">
          I accept the hosting terms: I confirm I&apos;m allowed to run this event where I live
          (e.g. a MEHKO permit for paid home dinners in LA County). TABLE surfaces official
          compliance info and insurance options — it never gives legal verdicts.
        </span>
      </label>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
      <button
        className="btn btn-primary w-full"
        disabled={!accepted || pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction(
              "publish_event",
              { eventId, acceptTerms: true },
              [`/host/events/${eventId}`, "/host", "/"],
            );
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Going live…" : "Publish — open the doors"}
      </button>
    </div>
  );
}

/** Inline address editor (update_event tool). */
export function AddressForm({
  eventId,
  locationHint,
  locationAddress,
}: {
  eventId: string;
  locationHint: string | null;
  locationAddress: string | null;
}) {
  const router = useRouter();
  const [hint, setHint] = useState(locationHint ?? "");
  const [address, setAddress] = useState(locationAddress ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-1">
          Public teaser
        </label>
        <input className="field" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Silver Lake — address after booking" />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-1">
          Exact address (paid guests only)
        </label>
        <input className="field" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="1234 Sunset Blvd" />
      </div>
      <button
        className="btn btn-ghost w-full !py-2"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await toolAction(
              "update_event",
              { eventId, locationHint: hint, locationAddress: address },
              [`/host/events/${eventId}`, `/e/${eventId}`],
            );
            if (res.ok) {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
              router.refresh();
            }
          })
        }
      >
        {pending ? "Saving…" : saved ? "Saved ✓" : "Save location"}
      </button>
    </div>
  );
}

/** Manual AfterParty trigger (the scheduler also fires it ~12h after). */
export function AfterpartyButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <button
        className="btn btn-grape w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await toolAction("run_afterparty", { eventId }, [`/host/events/${eventId}`]);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Firing…" : "✨ Fire the AfterParty now"}
      </button>
      {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
      <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
        Fires automatically ~12h after the dinner. Every guest gets a feedback ask.
      </p>
    </div>
  );
}

/** Cohost personality picker. */
export function CohostVibePicker({
  eventId,
  current,
  options,
}: {
  eventId: string;
  current: string;
  options: { key: string; name: string; emoji: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          disabled={pending}
          className={`pill !py-2 !px-3.5 border transition-colors ${
            selected === o.key
              ? "bg-[color:var(--color-grape)] text-white border-transparent"
              : "bg-white border-[color:var(--color-ink)]/15 hover:border-[color:var(--color-grape)]"
          }`}
          onClick={() => {
            const prev = selected;
            setSelected(o.key);
            startTransition(async () => {
              const res = await toolAction("set_cohost_vibe", { eventId, vibe: o.key }, [
                `/host/events/${eventId}`,
              ]);
              if (!res.ok) setSelected(prev);
              else router.refresh();
            });
          }}
        >
          {o.emoji} {o.name}
        </button>
      ))}
    </div>
  );
}

/** Host-side seat cancellation (frees the seat, auto-promotes the waitlist). */
export function RemoveGuestButton({ ticketId, eventId }: { ticketId: string; eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="text-xs text-[color:var(--color-ink-faint)] underline underline-offset-2 shrink-0"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this guest? Their seat goes to the waitlist.")) return;
        startTransition(async () => {
          await toolAction("cancel_ticket", { ticketId }, [`/host/events/${eventId}`]);
          router.refresh();
        });
      }}
    >
      {pending ? "…" : "remove"}
    </button>
  );
}
