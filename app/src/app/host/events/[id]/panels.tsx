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
          (e.g. a MEHKO permit for paid home dinners in LA County). plot surfaces official
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

/** Theme picker — a theme re-renders the night, not re-skins it. */
export function ThemePicker({
  eventId,
  current,
  options,
}: {
  eventId: string;
  current: string;
  options: { key: string; name: string; emoji: string; tagline: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          disabled={pending}
          className={`rounded-[var(--radius-pill)] border-2 px-4 py-2.5 text-left text-sm transition ${
            selected === o.key
              ? "border-[color:var(--color-ink)] bg-[color:var(--color-butter-soft)]"
              : "border-black/10 bg-white hover:border-black/30"
          }`}
          onClick={() => {
            const prev = selected;
            setSelected(o.key);
            startTransition(async () => {
              const res = await toolAction("update_event", { eventId, theme: o.key }, [
                `/host/events/${eventId}`,
                `/e/${eventId}`,
              ]);
              if (!res.ok) setSelected(prev);
              else router.refresh();
            });
          }}
        >
          <span className="font-semibold">{o.emoji} {o.name}</span>
          <span className="block text-xs text-[color:var(--color-ink-faint)]">{o.tagline}</span>
        </button>
      ))}
    </div>
  );
}

/** Night mechanics: twist intensity + mystery seat + duo tickets + deposit + moderation. */
export function NightMechanicsPanel({
  eventId,
  twistIntensity,
  mysterySeat,
  duoTickets,
  depositDollars,
  moderateOverheard,
  isFree,
  isPaid,
  isLive,
}: {
  eventId: string;
  twistIntensity: string;
  mysterySeat: boolean;
  duoTickets: boolean;
  depositDollars: number;
  moderateOverheard: boolean;
  isFree: boolean;
  isPaid: boolean;
  isLive: boolean;
}) {
  const router = useRouter();
  const [twist, setTwist] = useState(twistIntensity);
  const [mystery, setMystery] = useState(mysterySeat);
  const [duo, setDuo] = useState(duoTickets);
  const [moderate, setModerate] = useState(moderateOverheard);
  const [deposit, setDeposit] = useState(depositDollars ? String(depositDollars) : "");
  const [twistMsg, setTwistMsg] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function patch(input: Record<string, unknown>) {
    startTransition(async () => {
      await toolAction("update_event", { eventId, ...input }, [`/host/events/${eventId}`, `/e/${eventId}`]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-1.5">
          🌀 Plot twist intensity — the Cohost fires one mid-night
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["off", "chill", "spicy", "chaos"].map((t) => (
            <button
              key={t}
              disabled={pending}
              className={`pill capitalize transition ${twist === t ? "bg-[color:var(--color-ink)] text-[color:var(--color-cream)]" : "bg-white border border-black/10"}`}
              onClick={() => {
                setTwist(t);
                patch({ twistIntensity: t });
              }}
            >
              {t}
            </button>
          ))}
          {isLive && twist !== "off" ? (
            <button
              disabled={pending}
              className="pill bg-[color:var(--color-grape)] text-white"
              onClick={() =>
                startTransition(async () => {
                  const res = await toolAction("trigger_plot_twist", { eventId });
                  setTwistMsg(res.ok ? "Twist fired into the chat 🌀" : res.error);
                  setTimeout(() => setTwistMsg(undefined), 3500);
                })
              }
            >
              fire one now
            </button>
          ) : null}
        </div>
        {twistMsg ? <p className="text-xs mt-1.5 font-medium">{twistMsg}</p> : null}
      </div>

      {isPaid ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mystery}
              onChange={(e) => {
                setMystery(e.target.checked);
                patch({ mysterySeat: e.target.checked });
              }}
            />
            <span>🎭 <strong>Mystery seat</strong> — one blind ticket at 20% off</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={duo}
              onChange={(e) => {
                setDuo(e.target.checked);
                patch({ duoTickets: e.target.checked });
              }}
            />
            <span>👯 <strong>Duo tickets</strong> — two for 10% off each, the +1 must be new to plot</span>
          </label>
        </div>
      ) : null}

      {isFree ? (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-1.5">
            🤝 Refundable deposit (kills flaking — released at check-in)
          </p>
          <div className="flex gap-2">
            <input
              className="field !py-2 !w-28"
              placeholder="$0"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
            <button
              className="btn btn-ghost !py-2"
              disabled={pending}
              onClick={() => patch({ depositDollars: parseFloat(deposit) || 0 })}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={moderate}
          onChange={(e) => {
            setModerate(e.target.checked);
            patch({ moderateOverheard: e.target.checked });
          }}
        />
        <span>🗣 <strong>Moderate Overheard</strong> — approve quotes before they hit the Reveal</span>
      </label>
    </div>
  );
}

/** Host-side door check-in. */
export function HostCheckInButton({ ticketId, eventId }: { ticketId: string; eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="pill bg-[color:var(--color-mint-soft)] !text-[11px] cursor-pointer shrink-0"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toolAction("check_in_guest", { ticketId }, [`/host/events/${eventId}`]);
          router.refresh();
        })
      }
    >
      {pending ? "…" : "🚪 check in"}
    </button>
  );
}

/** Overheard moderation row (feature / hide pending quotes). */
export function ModerateQuoteButtons({ quoteId, eventId }: { quoteId: string; eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function act(action: "feature" | "hide") {
    startTransition(async () => {
      await toolAction("moderate_overheard", { quoteId, action }, [`/host/events/${eventId}`]);
      router.refresh();
    });
  }
  return (
    <span className="flex gap-1.5 shrink-0">
      <button className="pill bg-[color:var(--color-mint-soft)] !text-[11px] cursor-pointer" disabled={pending} onClick={() => act("feature")}>
        ✓ feature
      </button>
      <button className="pill bg-[color:var(--color-blush)] !text-[11px] cursor-pointer" disabled={pending} onClick={() => act("hide")}>
        ✕ hide
      </button>
    </span>
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
