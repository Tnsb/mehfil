import { db, tables } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import type { Event } from "@/db/schema";

export function formatPrice(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** paid + pending tickets hold seats; waitlisted/cancelled don't */
export async function seatsTaken(eventId: string): Promise<number> {
  const rows = await db
    .select({ id: tables.tickets.id })
    .from(tables.tickets)
    .where(
      and(
        eq(tables.tickets.eventId, eventId),
        inArray(tables.tickets.status, ["paid", "pending"]),
      ),
    );
  return rows.length;
}

/** JSON-safe event view. Address only included when the caller has earned it. */
export function eventView(event: Event, opts: { includeAddress: boolean; seatsLeft?: number }) {
  return {
    id: event.id,
    title: event.title,
    vibe: event.vibe,
    description: event.description,
    template: event.template,
    price: formatPrice(event.priceCents),
    priceCents: event.priceCents,
    capacity: event.capacity,
    seatsLeft: opts.seatsLeft,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
    locationHint: event.locationHint,
    ...(opts.includeAddress ? { locationAddress: event.locationAddress } : {}),
    url: `/e/${event.id}`,
  };
}

export async function getEventOrThrow(eventId: string): Promise<Event> {
  const [event] = await db.select().from(tables.events).where(eq(tables.events.id, eventId));
  if (!event) throw new Error(`Event not found: ${eventId}`);
  return event;
}

/**
 * Party access = host or paid guest. Gates the party chat, One Shot,
 * the AfterParty Drop, and mutual-tap.
 */
export async function hasPartyAccess(userId: string, event: Event): Promise<boolean> {
  if (event.hostId === userId) return true;
  const [paid] = await db
    .select({ id: tables.tickets.id })
    .from(tables.tickets)
    .where(
      and(
        eq(tables.tickets.eventId, event.id),
        eq(tables.tickets.userId, userId),
        eq(tables.tickets.status, "paid"),
      ),
    );
  return !!paid;
}
