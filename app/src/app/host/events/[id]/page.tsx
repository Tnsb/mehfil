import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { runTool } from "@/agent/registry";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime, formatPrice } from "@/lib/format";
import { VIBE_OPTIONS } from "@/cohost/vibes";
import {
  PublishPanel,
  AddressForm,
  AfterpartyButton,
  RemoveGuestButton,
  CohostVibePicker,
} from "./panels";

export const dynamic = "force-dynamic";

type RosterGuest = { ticketId: string; name: string; answers: Record<string, string> };
type Roster = {
  confirmed: RosterGuest[];
  pendingPayment: RosterGuest[];
  waitlist: RosterGuest[];
  revenue: string;
};
type Summary = {
  responses: number;
  responseRate: string;
  averageRating: number | null;
  repeatGuests: number;
  comments: { guest: string; rating: number; comment: string | null; visibility: string }[];
  suggestion: string;
};

export default async function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/host/events/${id}`);

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event || event.hostId !== user.id) notFound();

  const ctx = { userId: user.id, name: user.name ?? user.email, isSystem: false };
  const rosterRes = await runTool("get_event_roster", ctx, { eventId: id });
  const roster = rosterRes.ok ? (rosterRes.data as Roster) : null;

  const isPast = event.startsAt < new Date();
  const summaryRes =
    event.status === "completed"
      ? await runTool("get_afterparty_summary", ctx, { eventId: id })
      : null;
  const summary = summaryRes?.ok ? (summaryRes.data as Summary) : null;

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <Cover seed={event.id} className="h-28 rounded-[var(--radius-card)]">
          <div className="absolute bottom-3 left-4">
            <span className="pill bg-white/90 capitalize">{event.status.replace("_", " ")}</span>
          </div>
        </Cover>

        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">{event.title}</h1>
          <p className="text-[color:var(--color-ink-soft)] mt-1">
            {formatDateTime(event.startsAt)} · {formatPrice(event.priceCents)} · {event.capacity} seats
          </p>
          {event.status !== "draft" ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href={`/e/${event.id}`} className="text-sm font-semibold text-[color:var(--color-tangerine-deep)] underline underline-offset-2">
                View public page → share this link
              </Link>
              <Link href={`/party/${event.id}`} className="text-sm font-semibold text-[color:var(--color-grape)] underline underline-offset-2">
                Open the party chat
              </Link>
              {event.status === "completed" ? (
                <Link href={`/drop/${event.id}`} className="text-sm font-semibold text-[color:var(--color-grape)] underline underline-offset-2">
                  View the AfterParty Drop
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* the Cohost's personality */}
        <div className="card p-5">
          <h2 className="font-display text-xl font-semibold">Your AI Cohost</h2>
          <p className="text-sm text-[color:var(--color-ink-soft)] mt-1 mb-3">
            It lives in the party chat: welcomes guests, assigns who brings what, answers
            &ldquo;what&apos;s the address again?&rdquo; at 2am, and hands out superlatives after.
          </p>
          <CohostVibePicker eventId={event.id} current={event.cohostVibe} options={VIBE_OPTIONS} />
        </div>

        {/* status-driven action card */}
        {event.status === "draft" ? (
          <div className="card p-5 space-y-4">
            <h2 className="font-display text-xl font-semibold">Go live</h2>
            <AddressForm eventId={event.id} locationHint={event.locationHint} locationAddress={event.locationAddress} />
            <PublishPanel eventId={event.id} />
          </div>
        ) : event.status === "completed" && summary ? (
          <div className="card p-5 !bg-[color:var(--color-grape-soft)]">
            <h2 className="font-display text-xl font-semibold">✨ AfterParty summary</h2>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="card !shadow-none p-3">
                <p className="font-display text-2xl font-semibold">{summary.averageRating ?? "—"}</p>
                <p className="text-xs text-[color:var(--color-ink-soft)]">avg rating</p>
              </div>
              <div className="card !shadow-none p-3">
                <p className="font-display text-2xl font-semibold">{summary.responseRate}</p>
                <p className="text-xs text-[color:var(--color-ink-soft)]">responded</p>
              </div>
              <div className="card !shadow-none p-3">
                <p className="font-display text-2xl font-semibold">{summary.repeatGuests}</p>
                <p className="text-xs text-[color:var(--color-ink-soft)]">repeat guests</p>
              </div>
            </div>
            {summary.comments.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {summary.comments.map((c, i) => (
                  <li key={i} className="card !shadow-none p-3 text-sm">
                    <span className="text-[color:var(--color-tangerine)]">{"★".repeat(c.rating)}</span>
                    <span className="text-[color:var(--color-ink-faint)]">{"★".repeat(5 - c.rating)}</span>{" "}
                    <strong>{c.guest}</strong>
                    {c.comment ? <> — &ldquo;{c.comment}&rdquo;</> : null}
                    {c.visibility.startsWith("private") ? (
                      <span className="pill bg-[color:var(--color-blush)] ml-2 !text-[10px]">private</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--color-ink-soft)] mt-3">No responses yet — they trickle in through the morning.</p>
            )}
            <p className="text-sm mt-3 font-medium">{summary.suggestion}</p>
            <Link href="/chat" className="btn btn-grape w-full mt-3">◈ Open the next date with the crew</Link>
          </div>
        ) : isPast ? (
          <div className="card p-5">
            <h2 className="font-display text-xl font-semibold mb-3">The night happened 🎉</h2>
            <AfterpartyButton eventId={event.id} />
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <h2 className="font-display text-xl font-semibold">Location</h2>
            <AddressForm eventId={event.id} locationHint={event.locationHint} locationAddress={event.locationAddress} />
          </div>
        )}

        {/* roster */}
        {roster ? (
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold">Roster</h2>
              <span className="pill bg-[color:var(--color-mint-soft)] text-[color:var(--color-mint)]">
                {roster.revenue} in
              </span>
            </div>

            <Section title={`Confirmed (${roster.confirmed.length})`}>
              {roster.confirmed.map((g) => (
                <GuestRow key={g.ticketId} guest={g} eventId={event.id} removable={event.status !== "completed"} />
              ))}
              {roster.confirmed.length === 0 ? <Empty text="No confirmed guests yet — share the link." /> : null}
            </Section>

            {roster.pendingPayment.length > 0 ? (
              <Section title={`Holding a seat, unpaid (${roster.pendingPayment.length})`}>
                {roster.pendingPayment.map((g) => (
                  <GuestRow key={g.ticketId} guest={g} eventId={event.id} removable />
                ))}
              </Section>
            ) : null}

            {roster.waitlist.length > 0 ? (
              <Section title={`Waitlist (${roster.waitlist.length})`}>
                {roster.waitlist.map((g) => (
                  <GuestRow key={g.ticketId} guest={g} eventId={event.id} removable={false} />
                ))}
              </Section>
            ) : null}
          </div>
        ) : null}

        {/* compliance concierge (v1: routed info, never verdicts) */}
        <div className="card p-5 !bg-[color:var(--color-butter-soft)]">
          <h2 className="font-display text-xl font-semibold">Compliance concierge</h2>
          <p className="text-sm text-[color:var(--color-ink-soft)] mt-1.5 leading-relaxed">
            Charging for home-cooked meals in LA County is legal with a{" "}
            <a
              href="https://publichealth.lacounty.gov/eh/business/home-kitchen-operations.htm"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              MEHKO permit
            </a>{" "}
            (up to 30 meals/day, 90/week, $100k/yr). One-day event liability insurance is available
            from providers like Thimble. TABLE surfaces official info — it never determines your legality.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)] mb-2">{title}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function GuestRow({
  guest,
  eventId,
  removable,
}: {
  guest: RosterGuest;
  eventId: string;
  removable: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-sm py-1.5 border-b border-[color:var(--color-ink)]/6 last:border-0">
      <span className="size-7 rounded-full hero-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">
        {guest.name.charAt(0).toUpperCase()}
      </span>
      <span className="font-medium truncate">{guest.name}</span>
      {guest.answers?.dietary ? (
        <span className="pill bg-[color:var(--color-mint-soft)] !text-[11px] truncate">{guest.answers.dietary}</span>
      ) : null}
      <span className="flex-1" />
      {removable ? <RemoveGuestButton ticketId={guest.ticketId} eventId={eventId} /> : null}
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <li className="text-sm text-[color:var(--color-ink-faint)]">{text}</li>;
}
