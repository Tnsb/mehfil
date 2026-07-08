/**
 * The party room page: personalized invite card (persona + bring duty),
 * the group chat with the AI Cohost, and the One Shot camera.
 * Access: host + paid guests.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { Cover } from "@/components/cover";
import { OneShotButton } from "@/components/one-shot-button";
import { runTool } from "@/agent/registry";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { hasPartyAccess } from "@/agent/tools/helpers";
import { VIBES } from "@/cohost/vibes";
import { getTheme } from "@/themes";
import { PartyRoom } from "./party-room";
import { CheckInCard, OverheardCard, SuperlativeBallot } from "./night-panel";

export const dynamic = "force-dynamic";

export default async function PartyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/party/${id}`);

  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, id));
  if (!event) notFound();
  if (!(await hasPartyAccess(user.id, event))) redirect(`/e/${id}`);

  const ctx = { userId: user.id, name: user.name ?? user.email, isSystem: false };
  const chatRes = await runTool("get_party_chat", ctx, { eventId: id });
  const chat = chatRes.ok
    ? (chatRes.data as { messages: never[]; cohost: { name: string; emoji: string } })
    : { messages: [], cohost: { name: "Cohost", emoji: "◈" } };

  const [myTicket] = await db
    .select()
    .from(tables.tickets)
    .where(
      and(
        eq(tables.tickets.eventId, id),
        eq(tables.tickets.userId, user.id),
        eq(tables.tickets.status, "paid"),
      ),
    );

  const myShotTicketId = myTicket?.id ?? (event.hostId === user.id ? `host_${event.id}` : null);
  const [myPhoto] = myShotTicketId
    ? await db.select({ id: tables.photos.id }).from(tables.photos).where(eq(tables.photos.ticketId, myShotTicketId))
    : [];

  const started = event.startsAt <= new Date();
  const completed = event.status === "completed";
  const vibe = VIBES[event.cohostVibe];
  const theme = getTheme(event.theme);

  // fellow guests, for the superlative ballot (exclude self + unclaimed duo seats)
  const guestRows = await db
    .select({ ticket: tables.tickets, guest: tables.users })
    .from(tables.tickets)
    .innerJoin(tables.users, eq(tables.tickets.userId, tables.users.id))
    .where(and(eq(tables.tickets.eventId, id), eq(tables.tickets.status, "paid")));
  const ballotGuests = guestRows
    .filter((r) => r.ticket.userId !== user.id && !r.ticket.claimCode)
    .map((r) => ({ userId: r.guest.id, name: r.guest.name ?? "Guest" }));
  const [hostUser] = await db.select().from(tables.users).where(eq(tables.users.id, event.hostId));
  if (event.hostId !== user.id && hostUser)
    ballotGuests.push({ userId: hostUser.id, name: `${hostUser.name ?? "Host"} (host)` });

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <Cover
          seed={event.id}
          theme={{ ...theme.palette, emoji: theme.emoji }}
          className="h-24 rounded-[var(--radius-card)]"
        >
          <div className="absolute inset-0 flex items-center px-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-white drop-shadow-sm">
                {event.episodeNumber ? `S${event.season ?? 1}E${event.episodeNumber} · ` : ""}
                {event.title}
              </h1>
              <p className="text-white/90 text-sm">{formatDateTime(event.startsAt)} · {theme.emoji} {theme.name}</p>
            </div>
          </div>
        </Cover>

        {/* personalized invite: their card, their duty */}
        {myTicket?.persona ? (
          <div className="card p-5 !bg-[color:var(--color-butter-soft)] rise-in">
            <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--color-ink-soft)]">
              Your card tonight
            </p>
            <p className="font-display text-2xl font-semibold mt-1">
              {myTicket.persona.emoji} {myTicket.persona.card}
            </p>
            <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">{myTicket.persona.line}</p>
            {myTicket.bringItem ? (
              <p className="pill bg-white/80 mt-3">🎒 You&apos;re bringing: {myTicket.bringItem}</p>
            ) : null}
          </div>
        ) : null}

        {/* run-club extras: bib number */}
        {myTicket?.bibNumber ? (
          <div className="pill bg-[color:var(--color-mint-soft)] w-full justify-center">
            🏃 Your bib number: <strong className="ml-1">#{String(myTicket.bibNumber).padStart(3, "0")}</strong>
          </div>
        ) : null}

        {/* door check-in: opens at kickoff, releases deposit, unlocks One Shot */}
        {!completed && started && myTicket && !myTicket.checkedInAt ? (
          <CheckInCard ticketId={myTicket.id} hasDeposit={myTicket.depositStatus === "held"} />
        ) : null}
        {myTicket?.checkedInAt ? (
          <div className="pill bg-[color:var(--color-mint-soft)] w-full justify-center">
            ✓ Checked in{myTicket.depositStatus === "released" ? " — deposit released" : ""}
          </div>
        ) : null}

        {completed ? (
          <Link href={`/drop/${event.id}`} className="btn btn-grape w-full">
            ✨ The Reveal is live — see how the night developed
          </Link>
        ) : (
          <OneShotButton
            eventId={event.id}
            eventTitle={event.title}
            filmStock={theme.filmStock}
            alreadyShot={!!myPhoto}
            started={started}
            needsCheckIn={event.depositCents > 0 && !!myTicket && !myTicket.checkedInAt}
          />
        )}

        <PartyRoom
          eventId={event.id}
          initialMessages={chat.messages}
          cohostLabel={`${chat.cohost.emoji} ${chat.cohost.name}`}
        />

        <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
          The Cohost ({vibe.name}) answers questions — try &ldquo;what&apos;s the address again?&rdquo;
          The 🧣 button is Lost &amp; Found.
        </p>

        {/* the night's ambient mechanics — all feed the morning Reveal */}
        {started && !completed ? (
          <>
            <OverheardCard eventId={event.id} />
            <SuperlativeBallot
              eventId={event.id}
              categories={theme.superlatives}
              guests={ballotGuests}
            />
          </>
        ) : null}
        {!started ? (
          <div className="card p-4 text-sm text-[color:var(--color-ink-soft)]">
            <p className="font-semibold mb-1">🎬 Tonight&apos;s icebreakers ({theme.name})</p>
            <ul className="space-y-1 list-disc list-inside text-xs">
              {theme.icebreakers.map((ib) => (
                <li key={ib}>{ib}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
