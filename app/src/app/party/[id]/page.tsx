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
import { PartyRoom } from "./party-room";

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

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <Cover seed={event.id} className="h-24 rounded-[var(--radius-card)]">
          <div className="absolute inset-0 flex items-center px-5">
            <div>
              <h1 className="font-display text-2xl font-semibold text-white drop-shadow-sm">{event.title}</h1>
              <p className="text-white/90 text-sm">{formatDateTime(event.startsAt)}</p>
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

        {completed ? (
          <Link href={`/drop/${event.id}`} className="btn btn-grape w-full">
            ✨ The AfterParty Drop is live — see the reveal
          </Link>
        ) : (
          <OneShotButton eventId={event.id} alreadyShot={!!myPhoto} started={started} />
        )}

        <PartyRoom
          eventId={event.id}
          initialMessages={chat.messages}
          cohostLabel={`${chat.cohost.emoji} ${chat.cohost.name}`}
        />

        <p className="text-xs text-center text-[color:var(--color-ink-faint)]">
          The Cohost ({vibe.name}) answers questions — try &ldquo;what&apos;s the address again?&rdquo;
        </p>
      </div>
    </Shell>
  );
}
