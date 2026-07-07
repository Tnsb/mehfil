/**
 * The AfterParty Drop — the morning-after page:
 * One Shot reveal, Wrapped-style card, Taps (48h window, three intents),
 * feedback CTA, and one-tap "run it back" for the host.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { hasPartyAccess } from "@/agent/tools/helpers";
import { formatDate } from "@/lib/format";
import { TAP_INTENTS, tapWindow, hoursLeft } from "@/lib/taps";
import { TapButtons, RunItBackButton } from "./drop-actions";

export const dynamic = "force-dynamic";

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/drop/${id}`);

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event) notFound();
  if (!(await hasPartyAccess(user.id, event))) redirect(`/e/${id}`);
  if (event.status !== "completed") redirect(`/party/${id}`);

  const isHost = event.hostId === user.id;
  const [host] = await db.select().from(tables.users).where(eq(tables.users.id, event.hostId));

  /* the developed roll */
  const roll = await db
    .select({ photo: tables.photos, author: tables.users })
    .from(tables.photos)
    .innerJoin(tables.users, eq(tables.photos.userId, tables.users.id))
    .where(eq(tables.photos.eventId, event.id));

  /* fellow guests for mutual-tap */
  const attendees = await db
    .select({ ticket: tables.tickets, guest: tables.users })
    .from(tables.tickets)
    .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
    .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "paid")));
  const others = [
    ...attendees.filter((a) => a.guest.id !== user.id).map((a) => a.guest),
    ...(!isHost && host ? [host] : []),
  ];

  const taps = await db
    .select()
    .from(tables.connections)
    .where(
      and(
        eq(tables.connections.eventId, event.id),
        or(eq(tables.connections.fromUserId, user.id), eq(tables.connections.toUserId, user.id)),
      ),
    );
  /**
   * Double-blind state per person: a one-way or mismatched-intent tap only
   * ever shows the current user their OWN "tapped" state.
   */
  const tapState = (
    otherId: string,
  ): { kind: "none" } | { kind: "tapped" } | { kind: "matched"; intentLabel: string; chatUrl: string } => {
    const out = taps.find((t) => t.fromUserId === user.id && t.toUserId === otherId);
    if (!out) return { kind: "none" };
    const back = taps.find((t) => t.fromUserId === otherId && t.toUserId === user.id);
    if (back && back.intent === out.intent) {
      const meta = TAP_INTENTS[out.intent];
      return {
        kind: "matched",
        intentLabel: `${meta.emoji} ${meta.label}`,
        chatUrl: `/match/${event.id}/${otherId}`,
      };
    }
    return { kind: "tapped" };
  };

  const window = tapWindow(event);
  const matchCount = others.filter((g) => tapState(g.id).kind === "matched").length;

  /* wrapped: "your Nth night at Maya's" */
  const myNightsWithHost = isHost
    ? 0
    : (
        await db
          .select({ id: tables.tickets.id })
          .from(tables.tickets)
          .innerJoin(tables.events, eq(tables.tickets.eventId, tables.events.id))
          .where(
            and(
              eq(tables.tickets.userId, user.id),
              eq(tables.tickets.status, "paid"),
              eq(tables.events.hostId, event.hostId),
            ),
          )
      ).length;

  /* feedback state */
  const [myTicket] = attendees.filter((a) => a.guest.id === user.id).map((a) => a.ticket);
  const [myFeedback] = myTicket
    ? await db.select().from(tables.feedback).where(eq(tables.feedback.ticketId, myTicket.id))
    : [];

  const ordinal = (n: number) =>
    n % 10 === 1 && n % 100 !== 11 ? `${n}st` : n % 10 === 2 && n % 100 !== 12 ? `${n}nd` : n % 10 === 3 && n % 100 !== 13 ? `${n}rd` : `${n}th`;

  return (
    <Shell>
      <div className="hero-gradient-animated text-white">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="pill bg-white/20 backdrop-blur-sm text-white mb-3">✨ The AfterParty Drop</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold [text-wrap:balance]">
            {event.title}
          </h1>
          <p className="text-white/90 mt-1">
            {formatDate(event.startsAt)} · the roll developed overnight
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* One Shot reveal */}
        <section>
          <h2 className="font-display text-2xl font-semibold mb-3">📸 The One Shot reveal</h2>
          {roll.length === 0 ? (
            <div className="card p-6 text-center text-[color:var(--color-ink-soft)]">
              Nobody used their shot. A night too good to pause, apparently.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {roll.map(({ photo, author }, i) => (
                <figure
                  key={photo.id}
                  className="card overflow-hidden rise-in"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {/* data-URL photos; swap for blob storage + next/image in prod */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt={photo.caption ?? `One Shot by ${author.name}`} className="w-full aspect-square object-cover" />
                  <figcaption className="px-3 py-2 text-xs">
                    <span className="font-bold">{author.name ?? "Guest"}&apos;s one shot</span>
                    {photo.caption ? <span className="text-[color:var(--color-ink-soft)]"> — {photo.caption}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* Wrapped card */}
        <section className="card p-6 !bg-[color:var(--color-ink)] text-[color:var(--color-cream)] overflow-hidden relative">
          <span aria-hidden className="absolute -right-6 -top-8 text-[7rem] opacity-20 rotate-12 select-none">🪩</span>
          <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-butter)]">
            Your night, wrapped
          </p>
          <p className="font-display text-3xl font-semibold mt-2 leading-tight">
            {isHost
              ? `You fed ${attendees.length} ${attendees.length === 1 ? "person" : "people"} tonight.`
              : `Your ${ordinal(myNightsWithHost)} night at ${host?.name ?? "the host"}'s.`}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="pill bg-white/15">{attendees.length} at the table</span>
            <span className="pill bg-white/15">
              {roll.length} shot{roll.length === 1 ? "" : "s"} developed
            </span>
            <span className="pill bg-white/15">
              {matchCount} match{matchCount === 1 ? "" : "es"} made
            </span>
          </div>
          <p className="text-xs text-white/60 mt-4">screenshot this. you know you want to.</p>
        </section>

        {/* Taps: three intents, double-blind, 48h window */}
        {others.length > 0 ? (
          <section className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Taps</h2>
              {window.state === "open" ? (
                <span className="pill bg-[color:var(--color-butter-soft)] text-[color:var(--color-ink)] shrink-0">
                  ⏳ closes in {hoursLeft(window.closesAt)}h
                </span>
              ) : (
                <span className="pill bg-[color:var(--color-cream-deep)] text-[color:var(--color-ink-faint)] shrink-0">
                  window closed
                </span>
              )}
            </div>
            <p className="text-sm text-[color:var(--color-ink-soft)] mt-1 mb-3">
              Tap anyone from the table as {TAP_INTENTS.vibe.emoji} <strong>Vibe</strong> (friend),{" "}
              {TAP_INTENTS.collab.emoji} <strong>Collab</strong> (build something), or{" "}
              {TAP_INTENTS.crush.emoji} <strong>Crush</strong>. Nobody ever finds out unless they
              tap you back the same way — then the Cohost opens your chat.
            </p>
            <ul className="space-y-2.5">
              {others.map((g) => (
                <li key={g.id} className="flex items-center gap-3">
                  <span className="size-8 rounded-full hero-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {(g.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium text-sm flex-1 truncate">
                    {g.name ?? "Guest"}
                    {g.id === event.hostId ? (
                      <span className="text-xs text-[color:var(--color-ink-faint)]"> · host</span>
                    ) : null}
                  </span>
                  {window.state === "open" || tapState(g.id).kind === "matched" ? (
                    <TapButtons eventId={event.id} toUserId={g.id} initialState={tapState(g.id)} />
                  ) : (
                    <span className="text-xs text-[color:var(--color-ink-faint)]">—</span>
                  )}
                </li>
              ))}
            </ul>
            {window.state === "closed" ? (
              <p className="text-xs text-[color:var(--color-ink-faint)] mt-3">
                Taps live for 48 hours after the reveal. Matches made in time stay open forever.
              </p>
            ) : null}
          </section>
        ) : null}

        {/* feedback / run it back */}
        {isHost ? (
          <section className="card p-5 space-y-3">
            <h2 className="font-display text-xl font-semibold">Keep it going</h2>
            <RunItBackButton eventId={event.id} />
            <Link href={`/host/events/${event.id}`} className="btn btn-ghost w-full">
              See the full AfterParty summary
            </Link>
          </section>
        ) : myTicket && !myFeedback ? (
          <Link href={`/feedback/${myTicket.id}`} className="btn btn-primary w-full">
            ⭐ Rate the night — 30 seconds, while it&apos;s fresh
          </Link>
        ) : myFeedback ? (
          <p className="text-sm text-center text-[color:var(--color-ink-soft)]">
            You rated the night {myFeedback.rating}★ — thanks for that.
          </p>
        ) : null}
      </div>
    </Shell>
  );
}
