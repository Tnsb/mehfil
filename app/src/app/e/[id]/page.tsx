import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { Countdown } from "@/components/countdown";
import { ShareLink } from "@/components/share-link";
import { seatsTaken } from "@/agent/tools/helpers";
import { effectivePriceCents } from "@/agent/tools/tickets";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { getTheme } from "@/themes";
import { BookForm } from "./book-form";
import { CancelTicketButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event || event.status === "draft" || event.status === "cancelled") notFound();

  const user = await getCurrentUser();
  const [host] = await db.select().from(tables.users).where(eq(tables.users.id, event.hostId));
  const theme = getTheme(event.theme);
  const taken = await seatsTaken(event.id);
  const seatsLeft = Math.max(0, event.capacity - taken);
  const soldOut = seatsLeft === 0 || event.status === "sold_out";
  const isHost = user?.id === event.hostId;
  const past = event.startsAt < new Date() || event.status === "completed";
  const inEarlyAccess = !!event.publicAt && event.publicAt > new Date();

  const myTicket = user
    ? (
        await db
          .select()
          .from(tables.tickets)
          .where(
            and(
              eq(tables.tickets.eventId, event.id),
              eq(tables.tickets.userId, user.id),
              inArray(tables.tickets.status, ["paid", "pending", "waitlisted"]),
            ),
          )
      )[0]
    : undefined;

  // social proof: "Maya and 5 others are going"
  const goingRows = await db
    .select({ ticket: tables.tickets, guest: tables.users })
    .from(tables.tickets)
    .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
    .where(and(eq(tables.tickets.eventId, event.id), eq(tables.tickets.status, "paid")))
    .orderBy(asc(tables.tickets.createdAt));
  const realGoing = goingRows.filter((r) => !(r.ticket.kind === "duo_guest" && r.ticket.claimCode));
  const firstName = realGoing[0]?.guest.name?.split(" ")[0];
  const socialProof =
    realGoing.length >= 2 && firstName
      ? `${firstName} and ${realGoing.length - 1} other${realGoing.length - 1 === 1 ? "" : "s"} are going`
      : realGoing.length === 1 && firstName
        ? `${firstName} is going`
        : null;

  // mystery seat still up for grabs?
  const mysterySeatOpen =
    event.mysterySeat &&
    !goingRows.some((r) => r.ticket.kind === "mystery") &&
    event.priceCents > 0;

  const [show] = event.showId
    ? await db.select().from(tables.shows).where(eq(tables.shows.id, event.showId))
    : [undefined];

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Cover
          seed={event.id}
          theme={{ ...theme.palette, emoji: theme.emoji }}
          className="h-44 md:h-56 rounded-[var(--radius-card)] shadow-[var(--shadow-warm-lg)]"
        >
          <div className="absolute top-3 left-4 flex gap-2">
            {event.episodeNumber ? (
              <span className="pill bg-black/40 text-white backdrop-blur">
                {show ? `${show.emoji} ${show.title} · ` : ""}S{event.season ?? 1}E{event.episodeNumber}
              </span>
            ) : null}
          </div>
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
            <span className="pill bg-white/90">{formatPrice(event.priceCents)}</span>
            <span className="pill bg-white/90">
              {soldOut ? "Sold out" : `${seatsLeft} of ${event.capacity} seats left`}
            </span>
            <span className="pill bg-white/90">{theme.emoji} {theme.name}</span>
          </div>
        </Cover>

        <div className="mt-5 rise-in">
          <h1 className="font-display text-3xl md:text-4xl font-semibold leading-tight [text-wrap:balance]">
            {event.title}
          </h1>
          {event.vibe ? (
            <p className="text-lg text-[color:var(--color-ink-soft)] mt-1.5">{event.vibe}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="pill bg-[color:var(--color-butter-soft)]">🗓 {formatDateTime(event.startsAt)}</span>
            {!past ? <Countdown to={event.startsAt.toISOString()} /> : null}
            <span className="pill bg-[color:var(--color-blush)]">
              📍 {myTicket?.status === "paid" || isHost
                ? event.locationAddress ?? event.locationHint ?? "TBA"
                : event.locationHint ?? "Address revealed after booking"}
            </span>
            <span className="pill bg-[color:var(--color-mint-soft)]">
              ♨ Hosted by {host?.name ?? "your host"}
            </span>
            {socialProof ? (
              <span className="pill bg-[color:var(--color-butter-soft)]">🔥 {socialProof}</span>
            ) : null}
            {event.depositCents > 0 && event.priceCents === 0 ? (
              <span className="pill bg-[color:var(--color-blush)]">
                🤝 {formatPrice(event.depositCents)} hold, back at check-in
              </span>
            ) : null}
            {event.template === "run_club" ? (
              <span className="pill bg-[color:var(--color-mint-soft)]">🏃 Bib numbers + waiver at booking</span>
            ) : null}
          </div>

          {inEarlyAccess ? (
            <div className="mt-4 rounded-[var(--radius-card)] bg-[color:var(--color-ink)] text-[color:var(--color-cream)] p-4 text-sm flex flex-wrap items-center gap-2">
              <span className="font-semibold">🔑 Early access drop.</span>
              <span>Guests from previous episodes book first — doors open to everyone in</span>
              <Countdown to={event.publicAt!.toISOString()} />
            </div>
          ) : null}

          {event.description ? (
            <p className="mt-5 leading-relaxed text-[color:var(--color-ink-soft)] whitespace-pre-line">
              {event.description}
            </p>
          ) : null}

          <p className="mt-3 text-sm text-[color:var(--color-ink-faint)] italic">
            Dress code: {theme.dressCode}
          </p>
        </div>

        <div className="card p-5 mt-6">
          {isHost ? (
            <div className="text-center space-y-3">
              <p className="font-semibold">This is your table.</p>
              <Link href={`/host/events/${event.id}`} className="btn btn-ink w-full">
                Manage event & roster
              </Link>
            </div>
          ) : past ? (
            myTicket?.status === "paid" && event.status === "completed" ? (
              <Link href={`/drop/${event.id}`} className="btn btn-grape w-full">
                ✨ The Reveal is live — see how the night developed
              </Link>
            ) : (
              <p className="text-center text-[color:var(--color-ink-soft)]">
                This one already happened.{myTicket?.status === "paid" ? " The Reveal lands the morning after." : ""}
              </p>
            )
          ) : myTicket?.status === "paid" ? (
            <div className="reveal-open text-center space-y-3">
              <p className="text-3xl">🎟️</p>
              <p className="font-display text-2xl font-semibold">You&apos;re in!</p>
              <p className="text-[color:var(--color-ink-soft)]">
                📍 <strong>{event.locationAddress ?? "Address coming from the host"}</strong>
              </p>
              <Link href={`/party/${event.id}`} className="btn btn-grape w-full">
                💬 Open the party chat — meet your Cohost
              </Link>
              <ShareLink
                path={`/e/${event.id}?ref=${user!.id}`}
                label="🔗 Share your invite link — bring someone good"
              />
              <CancelTicketButton ticketId={myTicket.id} eventId={event.id} />
            </div>
          ) : myTicket?.status === "pending" ? (
            <div className="text-center space-y-3">
              <p className="font-semibold">Your seat is on hold.</p>
              <Link href={`/pay/${myTicket.id}`} className="btn btn-primary w-full">
                Complete payment · {formatPrice(
                  event.priceCents > 0
                    ? effectivePriceCents(event, myTicket.kind)
                    : event.depositCents,
                )}
              </Link>
              <CancelTicketButton ticketId={myTicket.id} eventId={event.id} />
            </div>
          ) : myTicket?.status === "waitlisted" ? (
            <div className="text-center space-y-2">
              <p className="text-2xl">⏳</p>
              <p className="font-semibold">You&apos;re on the waitlist.</p>
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                If a seat opens, it&apos;s yours — we&apos;ll notify you instantly.
              </p>
              <CancelTicketButton ticketId={myTicket.id} eventId={event.id} />
            </div>
          ) : user ? (
            <BookForm
              eventId={event.id}
              questions={event.questions ?? []}
              price={formatPrice(event.priceCents)}
              soldOut={soldOut}
              mysterySeatOpen={mysterySeatOpen}
              mysteryPrice={formatPrice(Math.round(event.priceCents * 0.8))}
              duoTickets={event.duoTickets && event.priceCents > 0}
              duoPrice={formatPrice(Math.round(event.priceCents * 0.9) * 2)}
              needsWaiver={event.template === "run_club"}
              depositLabel={
                event.priceCents === 0 && event.depositCents > 0
                  ? formatPrice(event.depositCents)
                  : undefined
              }
            />
          ) : (
            <div className="text-center space-y-3">
              <p className="text-[color:var(--color-ink-soft)]">Sign in to grab a seat — takes 20 seconds.</p>
              <Link href={`/login?next=/e/${event.id}`} className="btn btn-primary w-full">
                Sign in & book · {formatPrice(event.priceCents)}
              </Link>
            </div>
          )}
        </div>

        {show ? (
          <div className="mt-4 text-center">
            <Link
              href={`/show/${show.id}`}
              className="text-sm font-medium text-[color:var(--color-grape)] underline underline-offset-4"
            >
              {show.emoji} Part of {show.title} — see every episode
            </Link>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
